import logging
from decimal import ROUND_HALF_UP, Decimal

import razorpay
from django.conf import settings
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.access.services import grant_enrollment

from .models import Coupon, Order, Payment, Plan

log = logging.getLogger(__name__)
TWO = Decimal("0.01")


def razorpay_client():
    return razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))


def compute_amounts(plan: Plan, coupon: Coupon | None):
    """All money maths happens on the server. GST is added on top of the discounted price."""
    subtotal = plan.price
    discount = Decimal("0")
    if coupon:
        discount = (subtotal * coupon.percent_off / 100) + coupon.flat_off
        discount = min(discount, subtotal)
    taxable = subtotal - discount
    tax = (taxable * plan.gst_percent / 100).quantize(TWO, ROUND_HALF_UP)
    total = (taxable + tax).quantize(TWO, ROUND_HALF_UP)
    return subtotal, discount.quantize(TWO, ROUND_HALF_UP), tax, total


def create_order(user, plan_public_id, coupon_code=None) -> Order:
    try:
        plan = Plan.objects.get(public_id=plan_public_id, is_active=True)
    except Plan.DoesNotExist:
        raise ValidationError({"plan_id": "Plan not found."})

    coupon = None
    if coupon_code:
        coupon = Coupon.objects.filter(code__iexact=coupon_code).first()
        if not coupon or not coupon.is_valid():
            raise ValidationError({"coupon": "This coupon is invalid or expired."})

    subtotal, discount, tax, total = compute_amounts(plan, coupon)
    if total <= 0:
        raise ValidationError({"plan_id": "Order total must be greater than zero."})

    order = Order.objects.create(
        user=user, plan=plan, coupon=coupon, organization=user.organization,
        subtotal=subtotal, discount=discount, tax=tax, total=total,
    )
    rp = razorpay_client().order.create(
        {
            "amount": int(total * 100),  # paise
            "currency": "INR",
            "receipt": str(order.public_id),
            "notes": {"order_public_id": str(order.public_id), "user": user.email},
        }
    )
    order.razorpay_order_id = rp["id"]
    order.save(update_fields=["razorpay_order_id"])
    return order


def verify_checkout_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
    try:
        razorpay_client().utility.verify_payment_signature(
            {
                "razorpay_order_id": razorpay_order_id,
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_signature": razorpay_signature,
            }
        )
    except razorpay.errors.SignatureVerificationError:
        raise ValidationError({"detail": "Payment signature verification failed."})


@transaction.atomic
def fulfill_order(razorpay_order_id, razorpay_payment_id, method="", raw=None) -> Order:
    """Idempotent. Called from both the verify endpoint and the webhook."""
    order = Order.objects.select_for_update().get(razorpay_order_id=razorpay_order_id)
    if order.status == Order.Status.PAID:
        return order

    Payment.objects.update_or_create(
        razorpay_payment_id=razorpay_payment_id,
        defaults={
            "order": order, "method": method, "status": Payment.Status.CAPTURED,
            "amount": order.total, "raw_payload": raw or {},
        },
    )
    order.status = Order.Status.PAID
    order.paid_at = timezone.now()
    order.save(update_fields=["status", "paid_at", "updated_at"])

    for course in order.plan.covered_courses():
        grant_enrollment(order.user, course, plan=order.plan, order=order)

    user = order.user
    if user.status == user.Status.PENDING_PAYMENT:
        user.status = user.Status.ACTIVE
        user.save(update_fields=["status"])

    if order.coupon_id:
        Coupon.objects.filter(pk=order.coupon_id).update(used_count=F("used_count") + 1)

    from .tasks import generate_invoice  # local import avoids cycles

    transaction.on_commit(lambda: generate_invoice.delay(order.pk))
    return order


def record_failed_payment(razorpay_order_id, payment_entity):
    order = Order.objects.filter(razorpay_order_id=razorpay_order_id).first()
    if not order or order.status == Order.Status.PAID:
        return
    Payment.objects.update_or_create(
        razorpay_payment_id=payment_entity["id"],
        defaults={
            "order": order, "method": payment_entity.get("method", ""), "status": Payment.Status.FAILED,
            "amount": order.total, "error_description": (payment_entity.get("error_description") or "")[:255],
            "raw_payload": payment_entity,
        },
    )
    # Order stays 'created' so the student can retry on the same Razorpay order.
