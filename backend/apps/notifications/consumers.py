from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .services import STAFF_GROUP, group_name


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """One socket per browser tab. Carries notifications and support-chat events."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or user.is_anonymous:
            await self.close(code=4401)
            return
        self.groups_joined = [group_name(user)]
        if user.role == "admin" or user.is_superuser:
            self.groups_joined.append(STAFF_GROUP)
        for g in self.groups_joined:
            await self.channel_layer.group_add(g, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        for g in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(g, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"kind": "pong"})

    async def push(self, event):
        await self.send_json(event["data"])
