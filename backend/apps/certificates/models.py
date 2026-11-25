import secrets

from django.conf import settings
from django.db import models

from common.models import BaseModel

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I so codes survive being read aloud


def new_code():
    return "ITD-" + "".join(secrets.choice(_ALPHABET) for _ in range(10))


class Certificate(BaseModel):
    """Issued once per student per course. Name and title are frozen at issue time."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="certificates")
    course = models.ForeignKey("catalog.Course", on_delete=models.CASCADE, related_name="certificates")
    code = models.CharField(max_length=20, unique=True, default=new_code, editable=False)
    recipient_name = models.CharField(max_length=150)
    course_title = models.CharField(max_length=200)
    issued_at = models.DateTimeField(auto_now_add=True)
    average_score = models.PositiveIntegerField(null=True, blank=True, help_text="Best test scores averaged, percent")
    revoked = models.BooleanField(default=False)
    revoked_reason = models.CharField(max_length=200, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "course"], name="uniq_certificate_user_course")]
        ordering = ("-issued_at",)

    def __str__(self):
        return f"{self.code} {self.recipient_name}"
