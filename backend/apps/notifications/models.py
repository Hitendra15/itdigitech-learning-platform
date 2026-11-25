from django.conf import settings
from django.db import models

from common.models import BaseModel


class Notification(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    link = models.CharField(max_length=300, blank=True, help_text="Optional in-app path or URL")
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["user", "is_read"])]


class Announcement(BaseModel):
    class Audience(models.TextChoices):
        ALL = "all", "All users"
        ACTIVE = "active", "Paid students"
        PENDING = "pending", "Students who have not paid"

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    title = models.CharField(max_length=200)
    body = models.TextField()
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.ALL)
    send_email = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    recipients = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.title


class EmailLog(BaseModel):
    """One row per email attempt so admins can answer 'I never got the email'."""

    class Status(models.TextChoices):
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"

    to = models.EmailField()
    subject = models.CharField(max_length=255)
    template = models.CharField(max_length=60)
    status = models.CharField(max_length=10, choices=Status.choices)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=["to", "-created_at"])]


class ExportJob(BaseModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        DONE = "done", "Ready"
        FAILED = "failed", "Failed"

    kind = models.CharField(max_length=20)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED)
    file = models.FileField(upload_to="exports/", blank=True)
    row_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ("-created_at",)
