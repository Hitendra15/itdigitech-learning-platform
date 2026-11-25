from django.conf import settings
from django.db import models

from common.models import BaseModel


class ChatSession(BaseModel):
    """One conversation from the website chat widget. The public_id doubles as the visitor's secret."""

    class Status(models.TextChoices):
        BOT = "bot", "With assistant"
        WAITING = "waiting", "Waiting for an agent"
        LIVE = "live", "With an agent"
        CLOSED = "closed", "Closed"

    visitor_name = models.CharField(max_length=100)
    visitor_email = models.EmailField(blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="chats")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.BOT, db_index=True)
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    page_url = models.CharField(max_length=300, blank=True)
    last_message_at = models.DateTimeField(auto_now_add=True)
    visitor_seen_at = models.DateTimeField(null=True, blank=True)
    unread_by_staff = models.BooleanField(default=False)
    escalated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-last_message_at",)
        indexes = [models.Index(fields=["status", "-last_message_at"])]

    @property
    def reference(self):
        return f"CHAT-{self.pk:05d}"

    def __str__(self):
        return f"{self.reference} {self.visitor_name}"


class ChatMessage(BaseModel):
    class Sender(models.TextChoices):
        VISITOR = "visitor", "Visitor"
        BOT = "bot", "Assistant"
        AGENT = "agent", "Support team"

    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=Sender.choices)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    body = models.TextField(max_length=2000)

    class Meta:
        ordering = ("created_at", "id")
