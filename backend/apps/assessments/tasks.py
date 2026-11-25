from celery import shared_task
from django.utils import timezone

from .models import Attempt
from .services import grade_attempt


@shared_task
def auto_submit_expired_attempts():
    qs = Attempt.objects.filter(status=Attempt.Status.IN_PROGRESS, expires_at__lte=timezone.now())
    count = 0
    for attempt in qs:
        grade_attempt(attempt, expired=True)
        count += 1
    return count
