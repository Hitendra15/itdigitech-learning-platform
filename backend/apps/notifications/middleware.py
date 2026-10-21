from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache


@database_sync_to_async
def _get_user(pk):
    from apps.accounts.models import User

    return User.objects.filter(pk=pk, is_active=True).first() or AnonymousUser()


class TicketAuthMiddleware:
    """Authenticates a WebSocket using a one-time ticket from POST /auth/ws-ticket."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        qs = parse_qs(scope.get("query_string", b"").decode())
        ticket = (qs.get("ticket") or [None])[0]
        user = AnonymousUser()
        if ticket:
            key = f"wsticket:{ticket}"
            pk = cache.get(key)
            if pk:
                cache.delete(key)  # one-time use
                user = await _get_user(pk)
        scope["user"] = user
        return await self.inner(scope, receive, send)
