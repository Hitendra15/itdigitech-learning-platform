from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import Ticket


@shared_task
def auto_close_resolved_tickets():
    """Close tickets that have been resolved for a few days with no reply from the student."""
    from .services import update_ticket

    cutoff = timezone.now() - timedelta(days=settings.SUPPORT_AUTO_CLOSE_DAYS)
    n = 0
    for t in Ticket.objects.filter(status=Ticket.Status.RESOLVED, resolved_at__lte=cutoff).select_related("user"):
        update_ticket(t, status=Ticket.Status.CLOSED)
        n += 1
    return n
