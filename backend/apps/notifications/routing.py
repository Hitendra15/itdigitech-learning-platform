from django.urls import path

from apps.chat.consumers import VisitorChatConsumer

from .consumers import NotificationConsumer

websocket_urlpatterns = [path("ws/notifications/", NotificationConsumer.as_asgi()),
    path("ws/chat/<uuid:chat_id>/", VisitorChatConsumer.as_asgi()),
]
