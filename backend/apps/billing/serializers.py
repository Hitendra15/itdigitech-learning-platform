from rest_framework import serializers

from .models import Invoice, Order, Payment, Plan


class PlanSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    courses = serializers.SerializerMethodField()

    class Meta:
        model = Plan
        fields = ("id", "name", "plan_type", "price", "gst_percent", "validity_days", "courses")

    def get_courses(self, obj):
        return [{"title": c.title, "slug": c.slug} for c in obj.covered_courses()]


class CreateOrderSerializer(serializers.Serializer):
    plan_id = serializers.UUIDField()
    coupon = serializers.CharField(required=False, allow_blank=True)


class VerifySerializer(serializers.Serializer):
    razorpay_order_id = serializers.CharField()
    razorpay_payment_id = serializers.CharField()
    razorpay_signature = serializers.CharField()


class PaymentSerializer(serializers.ModelSerializer):
    plan = serializers.CharField(source="order.plan.name")
    total = serializers.DecimalField(source="order.total", max_digits=10, decimal_places=2)
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ("razorpay_payment_id", "method", "status", "plan", "total", "created_at", "invoice_url")

    def get_invoice_url(self, obj):
        inv = getattr(obj.order, "invoice", None)
        return inv.pdf_file.url if inv and inv.pdf_file else None
