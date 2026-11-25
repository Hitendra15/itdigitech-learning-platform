import json

import pytest
from asgiref.testing import ApplicationCommunicator
from django.core import mail

from apps.chat.models import ChatSession
from apps.support.models import FAQ


def start(client, **kw):
    return client.post("/api/v1/chat/sessions", {"name": "Ravi", "email": "ravi@example.com", **kw}, format="json")


def test_bot_answers_from_faq_then_hands_over(client, db):
    FAQ.objects.create(question="How do I reset my password?", answer="Use Forgot password on the sign-in page.")
    r = start(client)
    assert r.status_code == 201 and r.data["status"] == "bot" and "Hi Ravi" in r.data["messages"][0]["body"]
    cid = r.data["id"]

    r = client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "how to reset my password"}, format="json")
    assert r.data["status"] == "bot" and "Forgot password" in r.data["messages"][-1]["body"]

    r = client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "my laptop keeps exploding at midnight"}, format="json")
    assert r.data["status"] == "waiting" and "support team" in r.data["messages"][-1]["body"]


def test_asking_for_a_human_escalates_immediately(client, db):
    cid = start(client).data["id"]
    r = client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "I want to talk to a human"}, format="json")
    assert r.data["status"] == "waiting"


def test_agent_reply_reaches_visitor_and_emails_if_away(client, admin_client, db):
    cid = start(client).data["id"]
    client.post(f"/api/v1/chat/sessions/{cid}/human")
    ChatSession.objects.update(visitor_seen_at=None)  # visitor closed the tab
    r = admin_client.post(f"/api/v1/admin-api/chats/{cid}", {"body": "Hi Ravi, happy to help."}, format="json")
    assert r.status_code == 201 and r.data["status"] == "live"
    state = client.get(f"/api/v1/chat/sessions/{cid}").data
    assert state["messages"][-1]["sender"] == "agent" and state["status"] == "live"
    assert [m.to for m in mail.outbox] == [["ravi@example.com"]]


def test_staff_endpoints_are_admin_only(client, auth_client, admin_client, db):
    cid = start(client).data["id"]
    assert client.get("/api/v1/admin-api/chats").status_code in (401, 403)
    assert auth_client.get("/api/v1/admin-api/chats").status_code == 403
    assert len(admin_client.get("/api/v1/admin-api/chats").data) == 1
    assert admin_client.post(f"/api/v1/admin-api/chats/{cid}/close").data["status"] == "closed"
    assert client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "hello?"}, format="json").status_code == 400


def test_logged_in_student_is_linked(auth_client, user, db):
    r = start(auth_client)
    assert ChatSession.objects.get(public_id=r.data["id"]).user == user


def test_empty_message_rejected(client, db):
    cid = start(client).data["id"]
    assert client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "  "}, format="json").status_code == 400


@pytest.mark.django_db(transaction=True)
async def test_visitor_websocket_gets_agent_reply():
    from asgiref.sync import sync_to_async
    from rest_framework.test import APIClient

    from apps.accounts.models import User
    from apps.chat import services
    from apps.chat.consumers import VisitorChatConsumer

    def setup():
        cid = APIClient().post("/api/v1/chat/sessions", {"name": "Ravi"}, format="json").data["id"]
        return cid, User.objects.create_user("a@x.com", "Str0ng-pass!", role="admin", status="active")

    def comm(cid):
        scope = {"type": "websocket", "path": f"/ws/chat/{cid}/", "headers": [], "url_route": {"kwargs": {"chat_id": cid}}}
        return ApplicationCommunicator(VisitorChatConsumer.as_asgi(), scope)

    cid, admin = await sync_to_async(setup)()
    ws = comm(cid)
    await ws.send_input({"type": "websocket.connect"})
    assert (await ws.receive_output(1))["type"] == "websocket.accept"

    session = await sync_to_async(ChatSession.objects.get)(public_id=cid)
    await sync_to_async(services.agent_reply)(session, admin, "Hello there")
    out = await ws.receive_output(1)
    event = json.loads(out["text"])
    assert event["kind"] == "chat_message" and event["message"]["body"] == "Hello there"
    await ws.send_input({"type": "websocket.disconnect", "code": 1000})

    bad = comm("11111111-1111-1111-1111-111111111111")
    await bad.send_input({"type": "websocket.connect"})
    assert (await bad.receive_output(1))["type"] == "websocket.close"


def test_bot_matches_plurals_and_builtin_topics(client, db):
    cid = start(client).data["id"]
    r = client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "how do certificates work?"}, format="json")
    assert r.data["status"] == "bot" and "PDF certificate" in r.data["messages"][-1]["body"]
    r = client.post(f"/api/v1/chat/sessions/{cid}/messages", {"body": "what are your prices"}, format="json")
    assert r.data["status"] == "bot" and "Pricing page" in r.data["messages"][-1]["body"]
