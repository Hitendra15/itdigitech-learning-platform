from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class VisitorChatConsumer(AsyncJsonWebsocketConsumer):
    """Anonymous visitors join only the group of their own chat. The unguessable session UUID is the credential."""

    async def connect(self):
        self.chat_id = str(self.scope["url_route"]["kwargs"]["chat_id"])
        if not await self._exists():
            await self.close(code=4404)
            return
        self.group = f"chat_{self.chat_id}"
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive_json(self, content, **kwargs):
        if content.get("type") == "ping":
            await self.send_json({"kind": "pong"})

    async def push(self, event):
        await self.send_json(event["data"])

    @database_sync_to_async
    def _exists(self):
        from .models import ChatSession

        return ChatSession.objects.filter(public_id=self.chat_id).exclude(status="closed").exists()
