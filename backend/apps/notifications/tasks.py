import csv
import io
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.html import strip_tags

from .models import Announcement, EmailLog, ExportJob, Notification

log = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=15, retry_backoff=True, retry_backoff_max=600)
def send_templated_email(self, template, subject, to, context=None, attachments=None):
    """Render templates/emails/<template>.html and send it. Retries with backoff and
    records every attempt in EmailLog."""
    ctx = {
        "site_name": settings.SITE_NAME, "frontend_url": settings.FRONTEND_URL,
        "support_email": settings.SUPPORT_EMAIL, "year": timezone.now().year, "subject": subject,
        **(context or {}),
    }
    html = render_to_string(f"emails/{template}.html", ctx)
    text = _html_to_text(html)
    msg = EmailMultiAlternatives(subject, text, settings.DEFAULT_FROM_EMAIL, [to])
    msg.attach_alternative(html, "text/html")
    for name, content, mime in attachments or []:
        msg.attach(name, content, mime)
    try:
        msg.send()
    except Exception as exc:
        EmailLog.objects.create(to=to, subject=subject, template=template, status="failed", error=str(exc)[:1000])
        raise self.retry(exc=exc)
    EmailLog.objects.create(to=to, subject=subject, template=template, status="sent")
    return True


def _html_to_text(html):
    import re

    body = re.sub(r"(?is)<(style|head|script).*?</\1>", "", html)
    body = re.sub(r"(?i)<br\s*/?>|</p>|</h[1-6]>|</tr>", "\n", body)
    body = re.sub(r'(?is)<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"\2 (\1)", body)
    text = strip_tags(body)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()


@shared_task
def broadcast_announcement(announcement_id):
    """Fan an announcement out to every recipient: DB row + live push, plus email if requested."""
    from apps.accounts.models import User

    from .emails import display_name, queue_email
    from .services import push_user

    a = Announcement.objects.get(pk=announcement_id)
    users = User.objects.filter(is_active=True)
    if a.audience == Announcement.Audience.ACTIVE:
        users = users.filter(role="student", status="active")
    elif a.audience == Announcement.Audience.PENDING:
        users = users.filter(role="student", status="pending_payment")
    users = users.select_related("profile")

    count = 0
    batch = []
    try:
        for user in users.iterator(chunk_size=500):
            batch.append(Notification(user=user, title=a.title, body=a.body))
            count += 1
            if len(batch) >= 500:
                Notification.objects.bulk_create(batch)
                batch = []
            push_user(user, {"kind": "notification", "title": a.title, "body": a.body, "link": "",
                             "is_read": False, "created_at": timezone.now().isoformat()})
            if a.send_email:
                queue_email("announcement", a.title, user.email,
                            {"name": display_name(user), "title": a.title, "body": a.body})
        if batch:
            Notification.objects.bulk_create(batch)
        a.status, a.recipients, a.sent_at = Announcement.Status.SENT, count, timezone.now()
    except Exception:
        log.exception("announcement %s failed", announcement_id)
        a.status = Announcement.Status.FAILED
    a.save(update_fields=["status", "recipients", "sent_at", "updated_at"])
    return count


@shared_task
def purge_old_notifications(days=90):
    cutoff = timezone.now() - timedelta(days=days)
    deleted, _ = Notification.objects.filter(is_read=True, created_at__lt=cutoff).delete()
    return deleted


EXPORTS = {
    "orders": (
        ["Order ID", "Student", "Plan", "Subtotal", "Discount", "Tax", "Total", "Status", "Paid at", "Created"],
        lambda: __import__("apps.billing.models", fromlist=["Order"]).Order.objects.select_related("user", "plan")
        .order_by("-created_at"),
        lambda o: [str(o.public_id), o.user.email, o.plan.name, o.subtotal, o.discount, o.tax, o.total, o.status,
                   o.paid_at.isoformat() if o.paid_at else "", o.created_at.isoformat()],
    ),
    "users": (
        ["User ID", "Email", "Name", "Phone", "Role", "Status", "Email verified", "Joined"],
        lambda: __import__("apps.accounts.models", fromlist=["User"]).User.objects.select_related("profile")
        .order_by("-created_at"),
        lambda u: [str(u.public_id), u.email, getattr(getattr(u, "profile", None), "full_name", ""), u.phone,
                   u.role, u.status, u.is_email_verified, u.created_at.isoformat()],
    ),
}


@shared_task
def generate_export(job_id):
    """Build a CSV in the background, then tell the admin it is ready (live push + email)."""
    from .emails import queue_email
    from .services import notify

    job = ExportJob.objects.select_related("requested_by").get(pk=job_id)
    try:
        header, queryset, row = EXPORTS[job.kind]
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(header)
        n = 0
        for obj in queryset().iterator(chunk_size=1000):
            w.writerow(row(obj))
            n += 1
        name = f"{job.kind}-{timezone.now():%Y%m%d-%H%M%S}.csv"
        job.file.save(name, ContentFile(buf.getvalue().encode("utf-8-sig")))
        job.row_count, job.status = n, ExportJob.Status.DONE
        job.save()
        notify(job.requested_by, f"Your {job.kind} export is ready", f"{n} rows. Download it from Reports.", "/console/reports")
        queue_email("export_ready", f"Your {job.kind} export is ready", job.requested_by.email,
                    {"kind": job.kind, "rows": n, "url": f"{settings.FRONTEND_URL}/console/reports"})
    except Exception as exc:
        log.exception("export %s failed", job_id)
        job.status, job.error = ExportJob.Status.FAILED, str(exc)[:500]
        job.save()
        notify(job.requested_by, f"Your {job.kind} export failed", "Please try again.", "/console/reports")
