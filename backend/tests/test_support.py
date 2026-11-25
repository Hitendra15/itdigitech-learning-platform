import pytest
import json

from asgiref.testing import ApplicationCommunicator
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.notifications.consumers import NotificationConsumer
from apps.notifications.models import Notification
from apps.support.models import Ticket

NEW = {"subject": "Payment deducted but no access", "body": "I paid yesterday and my course is still locked.",
       "category": "payment", "priority": "high"}


@pytest.fixture
def ticket(auth_client):
    r = auth_client.post("/api/v1/support/tickets", NEW, format="json")
    assert r.status_code == 201
    return r.data


def test_student_creates_ticket_and_gets_confirmation(auth_client, user):
    r = auth_client.post("/api/v1/support/tickets", NEW, format="json")
    assert r.status_code == 201 and r.data["reference"].startswith("TKT-")
    assert any("We received your request" in m.subject for m in mail.outbox)
    assert Notification.objects.filter(user=user, title="Support request received").exists()
    assert len(auth_client.get("/api/v1/support/tickets").data) == 1


def test_ticket_validation(auth_client):
    r = auth_client.post("/api/v1/support/tickets", {"subject": "hi", "body": "short"}, format="json")
    assert r.status_code == 400


def test_students_cannot_see_each_others_tickets(ticket, db):
    other = APIClient()
    other.force_authenticate(User.objects.create_user("other@example.com", "Str0ng-pass!"))
    assert other.get(f"/api/v1/support/tickets/{ticket['id']}").status_code == 404
    assert other.post(f"/api/v1/support/tickets/{ticket['id']}/messages", {"body": "hello"}, format="json").status_code == 404


def test_admin_reply_emails_student_and_internal_notes_stay_private(ticket, auth_client, admin_client, user):
    mail.outbox.clear()
    r = admin_client.post(f"/api/v1/admin-api/tickets/{ticket['id']}/reply", {"body": "Checking this now."}, format="json")
    assert r.status_code == 201
    assert any(m.to == [user.email] and "New reply" in m.subject for m in mail.outbox)

    admin_client.post(f"/api/v1/admin-api/tickets/{ticket['id']}/reply",
                      {"body": "Razorpay shows captured. Escalate.", "internal": True}, format="json")
    detail = auth_client.get(f"/api/v1/support/tickets/{ticket['id']}").data
    assert [m["body"] for m in detail["messages"]] == [NEW["body"], "Checking this now."]
    assert detail["status"] == "waiting_on_student"

    staff_view = admin_client.get(f"/api/v1/admin-api/tickets/{ticket['id']}").data
    assert len(staff_view["messages"]) == 3
    assert staff_view["assigned_to"]["email"] == "boss@example.com"  # first responder owns it


def test_student_reply_reopens_and_closed_tickets_reject_replies(ticket, auth_client, admin_client):
    admin_client.post(f"/api/v1/admin-api/tickets/{ticket['id']}/reply", {"body": "Try again now."}, format="json")
    auth_client.post(f"/api/v1/support/tickets/{ticket['id']}/messages", {"body": "Still locked."}, format="json")
    assert Ticket.objects.get(public_id=ticket["id"]).status == "open"

    assert auth_client.post(f"/api/v1/support/tickets/{ticket['id']}/close").status_code == 200
    r = auth_client.post(f"/api/v1/support/tickets/{ticket['id']}/messages", {"body": "hello?"}, format="json")
    assert r.status_code == 400


def test_attachment_rules(auth_client, ticket):
    bad = SimpleUploadedFile("run.exe", b"MZ", content_type="application/octet-stream")
    r = auth_client.post(f"/api/v1/support/tickets/{ticket['id']}/messages", {"body": "see file", "attachment": bad},
                         format="multipart")
    assert r.status_code == 400
    ok = SimpleUploadedFile("receipt.pdf", b"%PDF-1.4 test", content_type="application/pdf")
    r = auth_client.post(f"/api/v1/support/tickets/{ticket['id']}/messages", {"body": "receipt attached", "attachment": ok},
                         format="multipart")
    assert r.status_code == 201 and r.data["attachment_name"].endswith(".pdf")


def test_staff_can_triage(ticket, admin_client, admin_user):
    tid = ticket["id"]
    r = admin_client.patch(f"/api/v1/admin-api/tickets/{tid}",
                           {"status": "in_progress", "priority": "urgent", "assigned_to": str(admin_user.public_id)},
                           format="json")
    assert r.status_code == 200 and r.data["priority"] == "urgent" and r.data["assigned_to"]["email"] == admin_user.email
    assert admin_client.patch(f"/api/v1/admin-api/tickets/{tid}", {"status": "bogus"}, format="json").status_code == 400
    assert admin_client.get("/api/v1/admin-api/tickets/counts").data["in_progress"] == 1
    assert admin_client.get("/api/v1/admin-api/tickets?status=active").data["count"] == 1


def test_auto_close_resolved_tickets(ticket, admin_client):
    from datetime import timedelta

    from django.utils import timezone

    from apps.support.tasks import auto_close_resolved_tickets

    admin_client.patch(f"/api/v1/admin-api/tickets/{ticket['id']}", {"status": "resolved"}, format="json")
    assert auto_close_resolved_tickets() == 0
    Ticket.objects.update(resolved_at=timezone.now() - timedelta(days=4))
    assert auto_close_resolved_tickets() == 1
    assert Ticket.objects.get().status == "closed"


class FakeSocket:
    """Minimal WebSocket client (channels.testing needs Daphne, which we do not use)."""

    def __init__(self, user):
        scope = {"type": "websocket", "path": "/ws/notifications/", "headers": [], "subprotocols": [], "user": user}
        self.comm = ApplicationCommunicator(NotificationConsumer.as_asgi(), scope)

    async def connect(self):
        await self.comm.send_input({"type": "websocket.connect"})
        out = await self.comm.receive_output(2)
        return out["type"] == "websocket.accept"

    async def next(self):
        out = await self.comm.receive_output(2)
        return json.loads(out["text"])

    async def idle(self):
        return await self.comm.receive_nothing(timeout=0.2)

    async def close(self):
        await self.comm.send_input({"type": "websocket.disconnect", "code": 1000})
        await self.comm.wait()


@pytest.mark.django_db(transaction=True)
async def test_websocket_pushes_replies_live():
    from asgiref.sync import sync_to_async
    from django.contrib.auth.models import AnonymousUser

    from apps.support import services

    student = await sync_to_async(User.objects.create_user)("ws@example.com", "Str0ng-pass!")
    admin = await sync_to_async(User.objects.create_user)("wsadmin@example.com", "Str0ng-pass!", role="admin")
    s_ws, a_ws = FakeSocket(student), FakeSocket(admin)
    assert await s_ws.connect() and await a_ws.connect()

    ticket = await sync_to_async(services.create_ticket)(
        student, "Cannot play video", "The player shows a blank screen.", "technical", "normal")
    event = await a_ws.next()  # admins hear about new tickets instantly
    assert event["kind"] == "ticket_new" and event["ticket_id"] == str(ticket.public_id)
    while not await s_ws.idle():  # drain the student's own confirmation notification
        await s_ws.next()

    await sync_to_async(services.add_message)(ticket, admin, "Please clear cache and retry.", staff=True)
    msg = await s_ws.next()
    assert msg["kind"] == "ticket_message" and msg["message"]["body"].startswith("Please clear cache")

    # internal notes reach staff only
    await sync_to_async(services.add_message)(ticket, admin, "Looks like a CDN issue.", staff=True, internal=True)
    while not await a_ws.idle():
        last = await a_ws.next()
    assert last["message"]["is_internal_note"] is True
    while not await s_ws.idle():
        leaked = await s_ws.next()
        assert not leaked.get("message", {}).get("is_internal_note")

    anon = FakeSocket(AnonymousUser())
    await anon.comm.send_input({"type": "websocket.connect"})
    assert (await anon.comm.receive_output(2))["type"] == "websocket.close"
    await s_ws.close()
    await a_ws.close()
