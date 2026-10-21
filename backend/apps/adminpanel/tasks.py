import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

log = logging.getLogger(__name__)


@shared_task
def bulk_grant_access(course_id, user_ids, validity_days=None):
    """Unlock one course for many students (a whole college, a CSV list...) without blocking the admin."""
    from apps.access.models import Enrollment
    from apps.accounts.models import User
    from apps.catalog.models import Course
    from apps.notifications.services import notify

    course = Course.objects.get(pk=course_id)
    now = timezone.now()
    done = 0
    for user in User.objects.filter(pk__in=user_ids, is_active=True):
        Enrollment.objects.update_or_create(
            user=user, course=course,
            defaults={"status": Enrollment.Status.ACTIVE, "starts_at": now, "organization": user.organization,
                      "expires_at": now + timedelta(days=int(validity_days)) if validity_days else None},
        )
        if user.status == User.Status.PENDING_PAYMENT:
            user.status = User.Status.ACTIVE
            user.save(update_fields=["status"])
        notify(user, "New course unlocked", f"You now have access to {course.title}.", f"/learn/{course.slug}")
        done += 1
    return done


@shared_task
def resend_invoice_email(order_pk):
    from apps.billing.models import Order

    order = Order.objects.select_related("user", "invoice").get(pk=order_pk)
    invoice = order.invoice
    mail = EmailMessage(
        subject=f"Your invoice {invoice.invoice_number}",
        body=f"Hello,\n\nAs requested, here is another copy of invoice {invoice.invoice_number}.\n\nIT DigiTech Solutions",
        from_email=settings.DEFAULT_FROM_EMAIL, to=[order.user.email],
    )
    with invoice.pdf_file.open("rb") as fh:
        mail.attach(f"{invoice.invoice_number}.pdf", fh.read(), "application/pdf")
    mail.send()
    return invoice.invoice_number
