from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications import emails
from apps.notifications.emails import display_name
from apps.notifications.services import notify, push_staff, push_user

from .models import Ticket, TicketMessage


def message_payload(m, request=None):
    url = None
    if m.attachment:
        url = request.build_absolute_uri(m.attachment.url) if request else m.attachment.url
    author = m.author
    name = "Support team" if m.is_staff_reply else (display_name(author) if author else "Student")
    return {
        "id": str(m.public_id), "body": m.body, "is_staff_reply": m.is_staff_reply,
        "is_internal_note": m.is_internal_note, "author": name, "created_at": m.created_at.isoformat(),
        "attachment": url, "attachment_name": m.attachment.name.rsplit("/", 1)[-1] if m.attachment else None,
    }


def _event(kind, ticket, message=None):
    data = {"kind": kind, "ticket_id": str(ticket.public_id), "reference": ticket.reference,
            "status": ticket.status, "subject": ticket.subject}
    if message is not None:
        data["message"] = message_payload(message)
    return data


def create_ticket(user, subject, body, category, priority, attachment=None) -> Ticket:
    with transaction.atomic():
        ticket = Ticket.objects.create(
            user=user, subject=subject.strip(), category=category, priority=priority, unread_by_staff=True
        )
        msg = TicketMessage.objects.create(ticket=ticket, author=user, body=body.strip(), attachment=attachment or "")
    _after_create(ticket, msg)  # emails + live push only after the data is committed
    return ticket


def _after_create(ticket, msg):
    user = ticket.user
    emails.queue_email(
        "ticket_created", f"[{ticket.reference}] We received your request", user.email,
        {"name": display_name(user), "reference": ticket.reference, "subject_line": ticket.subject,
         "url": f"{settings.FRONTEND_URL}/support/{ticket.public_id}"},
    )
    notify(user, "Support request received", f"{ticket.reference}: {ticket.subject}", f"/support/{ticket.public_id}")
    push_staff({**_event("ticket_new", ticket, msg), "priority": ticket.priority})


def add_message(ticket, author, body, *, staff=False, internal=False, attachment=None) -> TicketMessage:
    if ticket.status == Ticket.Status.CLOSED:
        raise ValidationError({"detail": "This request is closed. Open a new request if you still need help."})
    if internal and not staff:
        internal = False
    with transaction.atomic():
        msg = TicketMessage.objects.create(
            ticket=ticket, author=author, body=body.strip(), is_staff_reply=staff, is_internal_note=internal,
            attachment=attachment or "",
        )
        ticket.last_message_at = timezone.now()
        if not internal:
            if staff:
                ticket.unread_by_student = True
                if ticket.status in (Ticket.Status.OPEN, Ticket.Status.IN_PROGRESS):
                    ticket.status = Ticket.Status.WAITING
            else:
                ticket.unread_by_staff = True
                if ticket.status in (Ticket.Status.WAITING, Ticket.Status.RESOLVED):
                    ticket.status = Ticket.Status.OPEN
                    ticket.resolved_at = None
        ticket.save()
    _after_message(ticket, msg, staff, internal)
    return msg


def _after_message(ticket, msg, staff, internal):
    event = _event("ticket_message", ticket, msg)
    if internal:
        push_staff(event)  # internal notes never reach the student
        return
    if staff:
        student = ticket.user
        push_user(student, event)
        push_staff(event)
        agent = display_name(msg.author) if msg.author else "Our team"
        emails.queue_email(
            "ticket_reply", f"[{ticket.reference}] New reply from support", student.email,
            {"name": display_name(student), "reference": ticket.reference, "agent": agent,
             "subject_line": ticket.subject, "preview": msg.body[:600],
             "url": f"{settings.FRONTEND_URL}/support/{ticket.public_id}"},
        )
        notify(student, "New reply from support", f"{ticket.reference}: {ticket.subject}", f"/support/{ticket.public_id}")
    else:
        push_user(ticket.user, event)  # other tabs of the same student
        push_staff(event)
        if ticket.assigned_to and ticket.assigned_to.email:
            emails.queue_email(
                "ticket_student_reply", f"[{ticket.reference}] Student replied", ticket.assigned_to.email,
                {"student": display_name(ticket.user), "reference": ticket.reference, "subject_line": ticket.subject,
                 "preview": msg.body[:600], "url": f"{settings.FRONTEND_URL}/console/tickets/{ticket.public_id}"},
            )


def update_ticket(ticket, *, status=None, priority=None, assigned_to="__keep__"):
    """Staff changes. Pushes a live update to the student and to other admins."""
    changed = []
    if status and status != ticket.status:
        ticket.status = status
        ticket.resolved_at = timezone.now() if status == Ticket.Status.RESOLVED else None
        ticket.closed_at = timezone.now() if status == Ticket.Status.CLOSED else None
        changed.append("status")
    if priority and priority != ticket.priority:
        ticket.priority = priority
        changed.append("priority")
    if assigned_to != "__keep__" and assigned_to != ticket.assigned_to:
        ticket.assigned_to = assigned_to
        changed.append("assignee")
    if changed:
        ticket.save()
        push_staff(_event("ticket_update", ticket))
        if "status" in changed:
            push_user(ticket.user, _event("ticket_update", ticket))
            label = Ticket.Status(ticket.status).label
            notify(ticket.user, f"Request {label.lower()}", f"{ticket.reference}: {ticket.subject}",
                   f"/support/{ticket.public_id}")
    return ticket


def mark_read(ticket, *, staff):
    field = "unread_by_staff" if staff else "unread_by_student"
    if getattr(ticket, field):
        setattr(ticket, field, False)
        ticket.save(update_fields=[field, "updated_at"])
