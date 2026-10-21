from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import BaseModel


class EnrollmentQuerySet(models.QuerySet):
    def active(self):
        now = timezone.now()
        return self.filter(status=Enrollment.Status.ACTIVE).filter(
            models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=now)
        )


class Enrollment(BaseModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enrollments")
    course = models.ForeignKey("catalog.Course", on_delete=models.CASCADE, related_name="enrollments")
    plan = models.ForeignKey("billing.Plan", null=True, on_delete=models.SET_NULL)
    order = models.ForeignKey("billing.Order", null=True, on_delete=models.SET_NULL)
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.SET_NULL)
    starts_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)

    objects = EnrollmentQuerySet.as_manager()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "course"], name="uniq_enrollment_user_course")]
        indexes = [models.Index(fields=["user", "course"])]
