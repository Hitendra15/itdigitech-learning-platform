import os

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from common.models import BaseModel

ALLOWED_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".zip", ".doc", ".docx"}


def validate_attachment(f):
    ext = os.path.splitext(f.name)[1].lower()
    if ext not in ALLOWED_EXT:
        raise ValidationError("Attach an image, PDF, text, Word or ZIP file.")
    if f.size > settings.SUPPORT_MAX_UPLOAD_MB * 1024 * 1024:
        raise ValidationError(f"Attachments can be up to {settings.SUPPORT_MAX_UPLOAD_MB} MB.")


class FAQ(BaseModel):
    question = models.CharField(max_length=255)
    answer = models.TextField()
    category = models.CharField(max_length=60, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ("order", "id")
        verbose_name = "FAQ"

    def __str__(self):
        return self.question


class Ticket(BaseModel):
    class Category(models.TextChoices):
        PAYMENT = "payment", "Payment or invoice"
        ACCESS = "course_access", "Course access"
        TECHNICAL = "technical", "Technical problem"
        ACCOUNT = "account", "Account or login"
        OTHER = "other", "Something else"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In progress"
        WAITING = "waiting_on_student", "Waiting on student"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tickets")
    subject = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices, default=Category.OTHER)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_tickets"
    )
    last_message_at = models.DateTimeField(auto_now_add=True)
    unread_by_student = models.BooleanField(default=False)
    unread_by_staff = models.BooleanField(default=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-last_message_at",)
        indexes = [models.Index(fields=["status", "-last_message_at"]), models.Index(fields=["user", "-last_message_at"])]

    @property
    def reference(self):
        return f"TKT-{self.pk:05d}"

    @property
    def is_open(self):
        return self.status != self.Status.CLOSED

    def __str__(self):
        return f"{self.reference} {self.subject}"


class TicketMessage(BaseModel):
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+")
    is_staff_reply = models.BooleanField(default=False)
    is_internal_note = models.BooleanField(default=False, help_text="Visible to staff only")
    body = models.TextField()
    attachment = models.FileField(upload_to="support/%Y/%m/", blank=True, validators=[validate_attachment])

    class Meta:
        ordering = ("created_at", "id")
