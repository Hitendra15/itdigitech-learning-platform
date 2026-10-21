import logging
import uuid

from datetime import timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.models import Enrollment
from apps.accounts.models import User
from apps.assessments.models import Test
from apps.billing.models import Coupon, Order, Plan, WebhookEvent
from apps.billing.services import compute_amounts, fulfill_order
from apps.billing.tasks import generate_invoice
from apps.catalog.models import Course
from apps.notifications.emails import dispatch
from apps.organizations.models import Organization
from apps.support.models import Ticket
from common.permissions import IsAdminRole

from . import serializers as S
from . import serializers_ops as O
from .models import AuditLog
from .tasks import bulk_grant_access
from .views import AdminBase, AuditedModelViewSet

log = logging.getLogger(__name__)


def audit(request, action_name, obj):
    AuditLog.objects.create(
        actor=request.user, action=action_name, target_type=obj.__class__.__name__,
        target_id=str(getattr(obj, "public_id", obj.pk)), summary=str(obj)[:200],
    )


def parse_emails(value):
    if isinstance(value, str):
        value = value.replace(";", ",").replace("\n", ",").split(",")
    return sorted({e.strip().lower() for e in (value or []) if e and e.strip()})


# ---------------------------------------------------------------- colleges
class OrganizationViewSet(AuditedModelViewSet):
    serializer_class = O.OrganizationSerializer
    filterset_fields = ("is_active", "org_type")
    search_fields = ("name", "contact_email")
    ordering_fields = ("name", "created_at")

    def get_queryset(self):
        return Organization.objects.order_by("name").annotate(
            students_count=Count("users", filter=Q(users__role="student"), distinct=True))

    def perform_destroy(self, instance):
        n = instance.users.count()
        if n or instance.order_set.exists():
            raise ValidationError({"detail": f"This college has {n} students and past orders, so it cannot be deleted. "
                                              "Mark it as inactive instead."})
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"], url_path="add-students")
    def add_students(self, request, public_id=None):
        """Attach existing students to this college by email."""
        org = self.get_object()
        emails = parse_emails(request.data.get("emails"))
        if not emails:
            raise ValidationError({"emails": "Paste at least one email address."})
        found = User.objects.filter(email__in=emails, role="student")
        updated = found.update(organization=org)
        missing = sorted(set(emails) - set(found.values_list("email", flat=True)))
        audit(request, f"added {updated} students to", org)
        return Response({"updated": updated, "missing": missing})

    @action(detail=True, methods=["post"])
    def enroll(self, request, public_id=None):
        """Unlock a course for every active student of this college."""
        org = self.get_object()
        course = get_object_or_404(Course, public_id=request.data.get("course"), is_deleted=False)
        ids = list(User.objects.filter(organization=org, role="student", is_active=True).values_list("pk", flat=True))
        if not ids:
            raise ValidationError({"detail": "This college has no active students yet."})
        dispatch(bulk_grant_access, course.pk, ids, request.data.get("validity_days") or None)
        audit(request, f"unlocked {course.title} for", org)
        return Response({"queued": len(ids)})


# -------------------------------------------------------------- enrollments
class EnrollmentViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = O.EnrollmentSerializer
    search_fields = ("user__email", "user__profile__full_name", "course__title")
    ordering_fields = ("created_at", "expires_at")

    def get_queryset(self):
        qs = Enrollment.objects.select_related("user", "user__profile", "course", "organization").order_by("-created_at")
        p, now = self.request.query_params, timezone.now()
        if c := p.get("course"):
            qs = qs.filter(course__public_id=c)
        if o := p.get("org"):
            qs = qs.filter(organization__public_id=o)
        state = p.get("state")
        live = Q(status="active") & (Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        if state == "active":
            qs = qs.filter(live)
        elif state == "expired":
            qs = qs.filter(Q(status="expired") | (Q(status="active") & Q(expires_at__lte=now)))
        elif state == "revoked":
            qs = qs.filter(status="revoked")
        elif state == "expiring":
            qs = qs.filter(live, expires_at__lte=now + timedelta(days=14))
        return qs

    @action(detail=False, methods=["post"])
    def grant(self, request):
        """Unlock a course for students given by email, or for a whole college."""
        course = get_object_or_404(Course, public_id=request.data.get("course"), is_deleted=False)
        emails = parse_emails(request.data.get("emails"))
        org_id = request.data.get("organization")
        users = User.objects.none()
        if emails:
            users = User.objects.filter(email__in=emails, role="student", is_active=True)
        if org_id:
            org = get_object_or_404(Organization, public_id=org_id)
            users = users | User.objects.filter(organization=org, role="student", is_active=True)
        if not emails and not org_id:
            raise ValidationError({"detail": "Enter at least one student email, or choose a college."})
        ids = list(users.values_list("pk", flat=True).distinct())
        missing = sorted(set(emails) - set(User.objects.filter(email__in=emails, is_active=True, role="student").values_list("email", flat=True)))
        if ids:
            dispatch(bulk_grant_access, course.pk, ids, request.data.get("validity_days") or None)
            audit(request, f"unlocked {course.title} for {len(ids)} students:", course)
        return Response({"queued": len(ids), "missing": missing})

    @action(detail=False, methods=["post"])
    def revoke(self, request):
        ids = request.data.get("ids") or []
        n = Enrollment.objects.filter(public_id__in=ids).update(status=Enrollment.Status.REVOKED)
        if n:
            AuditLog.objects.create(actor=request.user, action=f"removed course access for {n} enrolments",
                                    target_type="Enrollment", summary=f"{n} enrolments")
        return Response({"revoked": n})


# ---------------------------------------------------------- offline payments
class QuoteView(APIView):
    """Preview what a plan (and optional coupon) costs, using the same maths as real checkout."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        plan = get_object_or_404(Plan, public_id=request.query_params.get("plan"))
        coupon = None
        if code := request.query_params.get("coupon"):
            coupon = Coupon.objects.filter(code__iexact=code.strip()).first()
            if not coupon or not coupon.is_valid():
                raise ValidationError({"coupon": "This coupon is invalid or expired."})
        sub, disc, tax, total = compute_amounts(plan, coupon)
        return Response({"subtotal": sub, "discount": disc, "tax": tax, "total": total, "gst_percent": plan.gst_percent})


class OfflinePaymentView(APIView):
    """Record a cash / bank transfer / cheque payment. It behaves exactly like an online one:
    the order is marked paid, courses unlock, an invoice is generated and emailed."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        ser = O.OfflinePaymentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user, plan, coupon = d["user"], d["plan"], d.get("coupon")
        subtotal, discount, tax, total = compute_amounts(plan, coupon)
        if total <= 0:
            raise ValidationError({"plan": "The order total must be greater than zero."})
        order = Order.objects.create(
            user=user, plan=plan, coupon=coupon, organization=user.organization,
            subtotal=subtotal, discount=discount, tax=tax, total=total,
            razorpay_order_id=f"offline_{uuid.uuid4().hex[:24]}",
        )
        raw = {"offline": True, "method": d["method"], "reference": d.get("reference", ""), "note": d.get("note", ""),
               "recorded_by": request.user.email}
        try:
            fulfill_order(order.razorpay_order_id, f"offline_{uuid.uuid4().hex[:24]}", method=f"offline:{d['method']}", raw=raw)
        except Exception:
            # The payment is saved before the invoice job is queued. If only the queue failed, finish inline.
            if not Order.objects.filter(pk=order.pk, status=Order.Status.PAID).exists():
                raise
            log.exception("invoice job could not be queued for offline order %s", order.pk)
            dispatch(generate_invoice, order.pk)
        order.refresh_from_db()
        audit(request, f"recorded an offline ({d['method']}) payment for", order)
        return Response(S.AdminOrderSerializer(order).data, status=201)


class WebhookEventViewSet(AdminBase, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = O.WebhookEventSerializer
    search_fields = ("event_type", "event_id")
    queryset = WebhookEvent.objects.order_by("-created_at")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("problems") == "1":
            qs = qs.exclude(error="")
        return qs


# ------------------------------------------------------------ setup checklist
class SetupStatusView(APIView):
    """A guided checklist for new admins. Server-level items are flagged so the admin knows to ask a developer."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.billing.models import Plan as P
        from apps.catalog.models import Lesson
        from apps.support.models import FAQ

        key, secret = settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET
        pay_ok = bool(key and secret) and "xxxx" not in key
        mode = "live" if key.startswith("rzp_live_") else "test" if key.startswith("rzp_test_") else None
        mail_ok = "console" not in settings.EMAIL_BACKEND and "locmem" not in settings.EMAIL_BACKEND
        cdn = (settings.VIDEO_CDN_HOST or "").strip()
        cdn_ok = bool(cdn) and "your-zone" not in cdn
        steps = [
            {"key": "course", "title": "Add your first course", "done": Course.objects.filter(is_deleted=False).exists(),
             "hint": "Create a course, then add modules and lessons to it.", "link": "/console/courses"},
            {"key": "lessons", "title": "Add lessons with video or notes", "done": Lesson.objects.filter(is_deleted=False).exists(),
             "hint": "Open a course and choose Curriculum.", "link": "/console/courses"},
            {"key": "plan", "title": "Create a plan students can buy", "done": P.objects.filter(is_active=True).exists(),
             "hint": "Set a price, GST and which courses it unlocks.", "link": "/console/plans"},
            {"key": "publish", "title": "Publish a course", "done": Course.objects.filter(is_deleted=False, is_published=True).exists(),
             "hint": "Students only see published courses.", "link": "/console/courses"},
            {"key": "faq", "title": "Write a few help articles", "done": FAQ.objects.filter(is_published=True).exists(),
             "hint": "They appear on the student Support page and suggest answers while students type.", "link": "/console/faqs"},
            {"key": "payments", "title": "Connect Razorpay", "done": pay_ok, "server": True,
             "hint": ("Connected in test mode. Switch to live keys before taking real payments." if pay_ok and mode == "test"
                      else "Ask your developer to add the Razorpay keys to the server settings." if not pay_ok else "Connected in live mode.")},
            {"key": "email", "title": "Turn on real email delivery", "done": mail_ok, "server": True,
             "hint": "Emails are currently printed in the server log. Ask your developer to add SMTP details." if not mail_ok else "Emails are being delivered."},
            {"key": "videos", "title": "Connect your video library", "done": cdn_ok, "server": True,
             "hint": "Ask your developer to set the video library address." if not cdn_ok else "Connected."},
        ]
        return Response({"steps": steps, "done": sum(s["done"] for s in steps), "total": len(steps), "payments_mode": mode})


# ------------------------------------------------------------------ search
class SearchView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"results": []})
        out = []
        for u in User.objects.filter(Q(email__icontains=q) | Q(phone__icontains=q) | Q(profile__full_name__icontains=q)).select_related("profile")[:5]:
            name = getattr(getattr(u, "profile", None), "full_name", "") or u.email
            out.append({"type": "Student" if u.role == "student" else "Staff", "title": name, "subtitle": u.email, "link": f"/console/users?search={u.email}"})
        for c in Course.objects.filter(is_deleted=False, title__icontains=q)[:4]:
            out.append({"type": "Course", "title": c.title, "subtitle": "Open curriculum", "link": f"/console/courses/{c.public_id}"})
        for t in Test.objects.filter(title__icontains=q).select_related("course")[:4]:
            out.append({"type": "Test", "title": t.title, "subtitle": t.course.title, "link": f"/console/tests/{t.public_id}"})
        for o in Organization.objects.filter(name__icontains=q)[:3]:
            out.append({"type": "College", "title": o.name, "subtitle": o.contact_email or "", "link": f"/console/colleges?search={o.name}"})
        for o in Order.objects.filter(Q(user__email__icontains=q) | Q(razorpay_order_id__icontains=q)).select_related("user", "plan")[:4]:
            out.append({"type": "Order", "title": f"{o.plan.name} · ₹{o.total}", "subtitle": o.user.email, "link": f"/console/orders?search={o.user.email}"})
        for t in Ticket.objects.filter(Q(subject__icontains=q) | Q(user__email__icontains=q)).select_related("user")[:4]:
            out.append({"type": "Request", "title": t.subject, "subtitle": f"{t.reference} · {t.user.email}", "link": f"/console/tickets/{t.public_id}"})
        return Response({"results": out})
