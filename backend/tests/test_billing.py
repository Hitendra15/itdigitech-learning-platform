import hashlib
import hmac
import json

import pytest

from apps.access.models import Enrollment
from apps.billing import services
from apps.billing.models import Coupon, Order, Payment, Plan, WebhookEvent


def test_amount_math(plan):
    coupon = Coupon(percent_off=10)
    sub, disc, tax, total = services.compute_amounts(plan, coupon)
    assert (sub, disc, tax, total) == (1000, 100, 162, 1062)


def test_fulfill_is_idempotent(order, user, course, django_capture_on_commit_callbacks):
    with django_capture_on_commit_callbacks(execute=True):
        services.fulfill_order("order_TEST1", "pay_1", "upi", {})
        services.fulfill_order("order_TEST1", "pay_1", "upi", {})  # second call = no-op
    user.refresh_from_db()
    assert user.status == "active"
    assert Enrollment.objects.filter(user=user, course=course).count() == 1
    assert Payment.objects.count() == 1
    assert Order.objects.get().status == "paid"
    assert Order.objects.get().invoice.invoice_number.startswith("ITD-")


def test_webhook_rejects_bad_signature(client, order):
    resp = client.post("/api/v1/billing/webhooks/razorpay", data="{}", content_type="application/json",
                       HTTP_X_RAZORPAY_SIGNATURE="bad")
    assert resp.status_code == 400


def test_webhook_captured_grants_access_and_is_deduped(client, order, user, course):
    payload = {"event": "payment.captured",
               "payload": {"payment": {"entity": {"id": "pay_9", "order_id": "order_TEST1", "method": "card"}}}}
    body = json.dumps(payload)
    sig = hmac.new(b"whsec", body.encode(), hashlib.sha256).hexdigest()
    kwargs = dict(data=body, content_type="application/json", HTTP_X_RAZORPAY_SIGNATURE=sig,
                  HTTP_X_RAZORPAY_EVENT_ID="evt_1")
    assert client.post("/api/v1/billing/webhooks/razorpay", **kwargs).status_code == 200
    assert client.post("/api/v1/billing/webhooks/razorpay", **kwargs).json()["status"] == "duplicate"
    assert WebhookEvent.objects.count() == 1
    assert Enrollment.objects.filter(user=user, course=course).exists()
