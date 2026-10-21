import io
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.mail import EmailMessage
from django.utils import timezone

from .models import Invoice, Order
from .services import fulfill_order, razorpay_client

log = logging.getLogger(__name__)


def _invoice_pdf(order, number):
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, h - 60, "IT DigiTech Solutions")
    c.setFont("Helvetica", 11)
    c.drawString(50, h - 90, f"Invoice: {number}")
    c.drawString(50, h - 108, f"Date: {order.paid_at:%d %b %Y}")
    c.drawString(50, h - 126, f"Billed to: {order.user.email}")
    y = h - 170
    rows = [("Plan", order.plan.name), ("Subtotal", order.subtotal), ("Discount", order.discount),
            (f"GST ({order.plan.gst_percent}%)", order.tax), ("Total paid (INR)", order.total)]
    for label, val in rows:
        c.drawString(50, y, str(label))
        c.drawRightString(w - 50, y, str(val))
        y -= 20
    c.showPage()
    c.save()
    return buf.getvalue()


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=5)
def generate_invoice(self, order_pk):
    order = Order.objects.select_related("user", "plan").get(pk=order_pk)
    if hasattr(order, "invoice"):
        return order.invoice.invoice_number
    number = f"ITD-{timezone.now():%Y%m}-{order.pk:06d}"
    invoice = Invoice.objects.create(order=order, invoice_number=number)
    pdf = _invoice_pdf(order, number)
    invoice.pdf_file.save(f"{number}.pdf", ContentFile(pdf))

    mail = EmailMessage(
        subject=f"Payment received - {number}",
        body="Thanks for your purchase. Your course access is active. Invoice attached.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[order.user.email],
    )
    mail.attach(f"{number}.pdf", pdf, "application/pdf")
    mail.send(fail_silently=True)

    from apps.notifications.services import notify

    notify(order.user, "Payment successful", "Your courses are now unlocked.")
    return number


@shared_task
def reconcile_pending_orders():
    """Safety net for lost webhooks / closed tabs: ask Razorpay what really happened."""
    cutoff = timezone.now() - timedelta(minutes=settings.PENDING_ORDER_MIN_AGE_MINUTES)
    stale = Order.objects.filter(
        status=Order.Status.CREATED, created_at__lt=cutoff, created_at__gt=timezone.now() - timedelta(days=2)
    ).exclude(razorpay_order_id__isnull=True)
    client = razorpay_client()
    fixed = 0
    for order in stale:
        try:
            items = client.order.payments(order.razorpay_order_id).get("items", [])
        except Exception:
            log.exception("reconcile failed for %s", order.razorpay_order_id)
            continue
        paid = next((p for p in items if p.get("status") == "captured"), None)
        if paid:
            fulfill_order(order.razorpay_order_id, paid["id"], paid.get("method", ""), paid)
            fixed += 1
    return fixed
