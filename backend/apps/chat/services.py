from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.notifications import emails
from apps.notifications.services import _send, push_staff

from . import bot
from .models import ChatMessage, ChatSession


def visitor_group(session):
    return f"chat_{session.public_id}"


def message_payload(m):
    return {"id": str(m.public_id), "sender": m.sender, "body": m.body, "created_at": m.created_at.isoformat(),
            "author": (m.author.profile.full_name if m.sender == "agent" and m.author and hasattr(m.author, "profile") else
                       "Support team" if m.sender == "agent" else "Assistant" if m.sender == "bot" else None)}


def session_payload(s):
    return {"id": str(s.public_id), "status": s.status, "reference": s.reference, "visitor_name": s.visitor_name,
            "emailKnown": bool(s.visitor_email)}


def _emit(session, message=None, kind="chat_message"):
    event = {"kind": kind, "chat_id": str(session.public_id), "status": session.status, "reference": session.reference,
             "visitor_name": session.visitor_name}
    if message is not None:
        event["message"] = message_payload(message)
    _send(visitor_group(session), event)
    push_staff(event)


def _add(session, sender, body, author=None):
    msg = ChatMessage.objects.create(session=session, sender=sender, body=body.strip(), author=author)
    session.last_message_at = timezone.now()
    session.save(update_fields=["last_message_at", "updated_at"])
    return msg


def start_session(name, email, user, page, first_message=""):
    session = ChatSession.objects.create(
        visitor_name=name.strip() or "Guest", visitor_email=email or "", user=user, page_url=(page or "")[:300],
        visitor_seen_at=timezone.now(),
    )
    greet, _ = bot.reply("hi", session.visitor_name)
    _add(session, "bot", greet)
    if first_message.strip():
        post_visitor_message(session, first_message)
    return session


def post_visitor_message(session, body):
    body = body.strip()
    if not body:
        raise ValidationError({"detail": "Type a message first."})
    if session.status == ChatSession.Status.CLOSED:
        raise ValidationError({"detail": "This chat has ended. Start a new one if you still need help."})
    with transaction.atomic():
        msg = _add(session, "visitor", body)
        session.unread_by_staff = True
        session.save(update_fields=["unread_by_staff", "updated_at"])
    _emit(session, msg)

    if session.status == ChatSession.Status.BOT:
        answer, handoff = bot.reply(body, session.visitor_name)
        if answer:
            _emit(session, _add(session, "bot", answer))
        if handoff:
            escalate(session)


def escalate(session):
    if session.status != ChatSession.Status.BOT:
        return
    session.status = ChatSession.Status.WAITING
    session.escalated_at = timezone.now()
    session.save(update_fields=["status", "escalated_at", "updated_at"])
    note = ("We will also email you at " + session.visitor_email + " if you step away."
            if session.visitor_email else "Add your email below if you would like a copy of the reply by email.")
    text = bot.HANDOFF.format(email_note=note)
    _emit(session, _add(session, "bot", text), kind="chat_escalated")


def agent_reply(session, agent, body):
    body = body.strip()
    if not body:
        raise ValidationError({"detail": "Type a message first."})
    if session.status == ChatSession.Status.CLOSED:
        raise ValidationError({"detail": "This chat is closed."})
    msg = _add(session, "agent", body, author=agent)
    session.status = ChatSession.Status.LIVE
    session.assigned_to = session.assigned_to or agent
    session.unread_by_staff = False
    session.save(update_fields=["status", "assigned_to", "unread_by_staff", "updated_at"])
    _emit(session, msg)
    away = not session.visitor_seen_at or session.visitor_seen_at < timezone.now() - timedelta(minutes=2)
    if away and session.visitor_email:  # visitor closed the tab: do not lose the reply
        emails.queue_email(
            "chat_reply", "Reply from IT DigiTech support", session.visitor_email,
            {"name": session.visitor_name.split(" ")[0], "preview": body[:800], "support_email": settings.SUPPORT_EMAIL,
             "url": f"{settings.FRONTEND_URL}/contact"},
        )
    return msg


def close_session(session, by_staff=False):
    if session.status == ChatSession.Status.CLOSED:
        return
    session.status = ChatSession.Status.CLOSED
    session.closed_at = timezone.now()
    session.unread_by_staff = False
    session.save(update_fields=["status", "closed_at", "unread_by_staff", "updated_at"])
    text = "This chat was closed by our team. Thanks for reaching out!" if by_staff else "Chat ended. Thanks for reaching out!"
    _emit(session, _add(session, "bot", text), kind="chat_closed")


def touch_seen(session):
    ChatSession.objects.filter(pk=session.pk).update(visitor_seen_at=timezone.now())
