from django.utils import timezone
from rest_framework import serializers

from apps.access.models import Enrollment
from apps.billing.models import Coupon, Plan, WebhookEvent
from apps.accounts.models import User
from apps.organizations.models import Organization

from .serializers import PublicIdModelSerializer, by_public_id


class OrganizationSerializer(PublicIdModelSerializer):
    students_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Organization
        fields = ("id", "name", "org_type", "contact_email", "is_active", "students_count", "created_at")

    def validate_name(self, v):
        v = v.strip()
        qs = Organization.objects.filter(name__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A college with this name already exists.")
        return v


class EnrollmentSerializer(PublicIdModelSerializer):
    student = serializers.CharField(source="user.email", read_only=True)
    student_name = serializers.SerializerMethodField()
    student_id = serializers.UUIDField(source="user.public_id", read_only=True)
    course_title = serializers.CharField(source="course.title", read_only=True)
    course_id = serializers.UUIDField(source="course.public_id", read_only=True)
    state = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()
    college = serializers.CharField(source="organization.name", read_only=True, default=None)

    class Meta:
        model = Enrollment
        fields = ("id", "student", "student_name", "student_id", "course_title", "course_id", "state", "source",
                  "college", "starts_at", "expires_at")

    def get_student_name(self, obj):
        return getattr(getattr(obj.user, "profile", None), "full_name", "") or obj.user.email

    def get_state(self, obj):
        if obj.status == Enrollment.Status.REVOKED:
            return "revoked"
        if obj.status == Enrollment.Status.EXPIRED or (obj.expires_at and obj.expires_at <= timezone.now()):
            return "expired"
        return "active"

    def get_source(self, obj):
        if obj.order_id:
            return "Purchased"
        return "Granted by admin"


class OfflinePaymentSerializer(serializers.Serializer):
    METHODS = [("cash", "Cash"), ("bank_transfer", "Bank transfer / NEFT"), ("upi", "UPI to company account"),
               ("cheque", "Cheque"), ("other", "Other")]
    user = by_public_id(User)
    plan = serializers.SlugRelatedField(slug_field="public_id", queryset=Plan.objects.filter(is_active=True))
    method = serializers.ChoiceField(choices=METHODS)
    reference = serializers.CharField(max_length=80, required=False, allow_blank=True)
    coupon = serializers.CharField(max_length=40, required=False, allow_blank=True)
    note = serializers.CharField(max_length=300, required=False, allow_blank=True)

    def validate_user(self, u):
        if u.role != User.Role.STUDENT:
            raise serializers.ValidationError("Choose a student account.")
        return u

    def validate_coupon(self, code):
        if not code:
            return None
        c = Coupon.objects.filter(code__iexact=code.strip()).first()
        if not c or not c.is_valid():
            raise serializers.ValidationError("This coupon is invalid or expired.")
        return c


class WebhookEventSerializer(PublicIdModelSerializer):
    summary = serializers.SerializerMethodField()
    state = serializers.SerializerMethodField()

    class Meta:
        model = WebhookEvent
        fields = ("id", "event_type", "event_id", "summary", "state", "processed_at", "error", "created_at")

    def get_summary(self, obj):
        try:
            ent = (obj.payload.get("payload", {}).get("payment") or obj.payload.get("payload", {}).get("order") or {}).get("entity", {})
            bits = [ent.get("id"), ent.get("email"), f"₹{int(ent['amount']) / 100:,.2f}" if ent.get("amount") else None]
            return " · ".join(b for b in bits if b)
        except Exception:
            return ""

    def get_state(self, obj):
        return "failed" if obj.error else ("processed" if obj.processed_at else "pending")
