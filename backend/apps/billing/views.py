import json
import logging

import razorpay
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Coupon, Payment, Plan, WebhookEvent
from .serializers import CreateOrderSerializer, PaymentSerializer, PlanSerializer, VerifySerializer

log = logging.getLogger(__name__)


class PlanListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = PlanSerializer
    pagination_class = None
    queryset = Plan.objects.filter(is_active=True, organization__isnull=True).order_by("price")


class CreateOrderView(APIView):
    def post(self, request):
        ser = CreateOrderSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        order = services.create_order(request.user, ser.validated_data["plan_id"], ser.validated_data.get("coupon"))
        return Response(
            {
                "order_id": str(order.public_id),
                "razorpay_order_id": order.razorpay_order_id,
                "razorpay_key_id": settings.RAZORPAY_KEY_ID,
                "amount": int(order.total * 100),
                "currency": order.currency,
                "plan": order.plan.name,
                "total": str(order.total),
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    def post(self, request):
        ser = VerifySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        services.verify_checkout_signature(d["razorpay_order_id"], d["razorpay_payment_id"], d["razorpay_signature"])
        # Order must belong to the caller
        from .models import Order

        if not Order.objects.filter(razorpay_order_id=d["razorpay_order_id"], user=request.user).exists():
            return Response({"detail": "Order not found."}, status=status.HTTP_404_NOT_FOUND)
        order = services.fulfill_order(d["razorpay_order_id"], d["razorpay_payment_id"])
        return Response({"status": order.status})


class CouponValidateView(APIView):
    def post(self, request):
        code = request.data.get("code", "")
        plan = Plan.objects.filter(public_id=request.data.get("plan_id")).first()
        coupon = Coupon.objects.filter(code__iexact=code).first()
        if not plan or not coupon or not coupon.is_valid():
            return Response({"valid": False}, status=status.HTTP_200_OK)
        sub, disc, tax, total = services.compute_amounts(plan, coupon)
        return Response({"valid": True, "discount": str(disc), "tax": str(tax), "total": str(total)})


class PaymentHistoryView(generics.ListAPIView):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        return (
            Payment.objects.filter(order__user=self.request.user)
            .select_related("order__plan")
            .order_by("-created_at")
        )


class RazorpayWebhookView(APIView):
    """Source of truth for payment state. Signature-verified, idempotent via event id."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        body = request.body.decode("utf-8")
        signature = request.headers.get("X-Razorpay-Signature", "")
        try:
            services.razorpay_client().utility.verify_webhook_signature(
                body, signature, settings.RAZORPAY_WEBHOOK_SECRET
            )
        except razorpay.errors.SignatureVerificationError:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        payload = json.loads(body)
        event_id = request.headers.get("X-Razorpay-Event-Id") or payload.get("id", "")
        event_type = payload.get("event", "")

        event, created = WebhookEvent.objects.get_or_create(
            event_id=event_id, defaults={"event_type": event_type, "payload": payload}
        )
        if not created and event.processed_at:
            return Response({"status": "duplicate"})

        try:
            self._handle(event_type, payload)
            event.processed_at = timezone.now()
            event.save(update_fields=["processed_at"])
        except Exception as exc:  # return 500 so Razorpay retries
            log.exception("webhook failed")
            event.error = str(exc)
            event.save(update_fields=["error"])
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({"status": "ok"})

    @staticmethod
    def _handle(event_type, payload):
        entity = payload.get("payload", {}).get("payment", {}).get("entity", {})
        if event_type in ("payment.captured", "order.paid") and entity:
            services.fulfill_order(entity["order_id"], entity["id"], entity.get("method", ""), entity)
        elif event_type == "payment.failed" and entity:
            services.record_failed_payment(entity["order_id"], entity)
