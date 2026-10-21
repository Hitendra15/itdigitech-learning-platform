from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification

STAFF_GROUP = "staff"


def group_name(user):
    return f"user_{user.public_id}"


def _send(group, data):
    layer = get_channel_layer()
    if not layer:
        return
    try:
        async_to_sync(layer.group_send)(group, {"type": "push", "data": data})
    except Exception:  # realtime is best effort; DB + email are the source of truth
        pass


def push_user(user, data):
    """Push any realtime event to one user's open tabs."""
    _send(group_name(user), data)


def push_staff(data):
    """Push to every admin currently connected."""
    _send(STAFF_GROUP, data)


def notify(user, title, body="", link=""):
    """Persist a notification and push it over WebSocket."""
    n = Notification.objects.create(user=user, title=title, body=body, link=link)
    push_user(
        user,
        {"kind": "notification", "id": str(n.public_id), "title": title, "body": body, "link": link,
         "is_read": False, "created_at": n.created_at.isoformat()},
    )
    return n
