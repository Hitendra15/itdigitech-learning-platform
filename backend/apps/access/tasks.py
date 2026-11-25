from celery import shared_task
from django.utils import timezone

from .models import Enrollment


@shared_task
def expire_enrollments():
    return Enrollment.objects.filter(
        status=Enrollment.Status.ACTIVE, expires_at__isnull=False, expires_at__lte=timezone.now()
    ).update(status=Enrollment.Status.EXPIRED)
