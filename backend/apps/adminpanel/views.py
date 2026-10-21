from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.models import Enrollment
from apps.learning.models import LessonProgress
from apps.accounts import auth, tokens
from apps.accounts.models import User
from apps.assessments.models import Attempt, Question, Test
from apps.billing.models import Coupon, Order, Plan
from apps.catalog.models import Course, Lesson, Module
from apps.notifications import emails
from apps.billing.tasks import generate_invoice
from apps.notifications.emails import dispatch
from apps.notifications.models import Announcement, EmailLog, ExportJob
from apps.notifications.services import notify
from apps.notifications.tasks import broadcast_announcement, generate_export
from apps.platform_config.models import FeatureFlag, SiteSetting
from apps.support import services as support
from apps.support.models import FAQ, Ticket
from apps.support.serializers import ReplySerializer, TicketSerializer, thread
from common.permissions import IsAdminRole

from . import serializers as S
from . import importers
from .models import AuditLog
from .tasks import resend_invoice_email


# ------------------------------------------------------------------ base
class AdminBase:
    permission_classes = [IsAdminRole]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    lookup_field = "public_id"
    lookup_value_regex = "[0-9a-f-]{36}"
    audit_name = None

    def _log(self, action_name, obj):
        AuditLog.objects.create(
            actor=self.request.user, action=action_name, target_type=self.audit_name or obj.__class__.__name__,
            target_id=str(getattr(obj, "public_id", obj.pk)), summary=str(obj)[:200],
        )


class AuditedModelViewSet(AdminBase, viewsets.ModelViewSet):
    def perform_create(self, serializer):
        obj = serializer.save()
        self._log("created", obj)

    def perform_update(self, serializer):
        obj = serializer.save()
        self._log("updated", obj)

    def perform_destroy(self, instance):
        self._log("deleted", instance)
        instance.delete()


class SoftDeleteMixin:
    def perform_destroy(self, instance):
        self._log("deleted", instance)
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])


class ReorderMixin:
    """POST {"ids": [...]} sets order=1..n in that sequence."""

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        ids = request.data.get("ids", [])
        qs = {str(o.public_id): o for o in self.get_queryset().filter(public_id__in=ids)}
        for i, pid in enumerate(ids, start=1):
            if pid in qs and qs[pid].order != i:
                qs[pid].order = i
                qs[pid].save(update_fields=["order", "updated_at"])
        return Response({"reordered": len(qs)})


# ------------------------------------------------------------- dashboard
class DashboardView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        now = timezone.now()
        d30, d14 = now - timedelta(days=30), now - timedelta(days=13)
        paid = Order.objects.filter(status=Order.Status.PAID)
        students = User.objects.filter(role="student")

        def series(qs, field, agg, start):
            rows = (qs.filter(**{f"{field}__gte": start}).annotate(day=TruncDate(field)).values("day")
                    .annotate(v=agg).order_by("day"))
            by_day = {r["day"]: r["v"] for r in rows}
            return [{"date": (start + timedelta(days=i)).date().isoformat(),
                     "value": float(by_day.get((start + timedelta(days=i)).date(), 0) or 0)} for i in range(14)]

        top = (Course.objects.filter(is_deleted=False)
               .annotate(n=Count("enrollments", filter=Q(enrollments__status="active")))
               .order_by("-n")[:5])
        tickets = Ticket.objects.exclude(status=Ticket.Status.CLOSED)
        return Response({
            "totals": {
                "students": students.count(),
                "active_students": students.filter(status="active").count(),
                "new_students_30d": students.filter(created_at__gte=d30).count(),
                "revenue_total": float(paid.aggregate(t=Sum("total"))["t"] or 0),
                "revenue_30d": float(paid.filter(paid_at__gte=d30).aggregate(t=Sum("total"))["t"] or 0),
                "orders_paid": paid.count(),
                "pending_orders": Order.objects.filter(status=Order.Status.CREATED).count(),
                "open_tickets": tickets.count(),
                "unanswered_tickets": tickets.filter(unread_by_staff=True).count(),
                "courses": Course.objects.filter(is_deleted=False, is_published=True).count(),
            },
            "signups": series(students, "created_at", Count("id"), d14),
            "revenue": series(paid, "paid_at", Sum("total"), d14),
            "top_courses": [{"title": c.title, "enrolled": c.n} for c in top],
            "recent_orders": S.AdminOrderSerializer(
                Order.objects.select_related("user", "plan", "coupon").prefetch_related("payments")[:6], many=True).data,
            "recent_tickets": TicketSerializer(
                tickets.select_related("user").prefetch_related("messages")[:6], many=True).data,
        })


# ----------------------------------------------------------------- users
class UserViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin,
                  viewsets.GenericViewSet):
    serializer_class = S.AdminUserSerializer
    filterset_fields = ("role", "status", "is_email_verified", "is_active")
    search_fields = ("email", "phone", "profile__full_name", "profile__college_name")
    ordering_fields = ("created_at", "email", "last_login")
    http_method_names = ["get", "post", "patch", "head", "options"]
    audit_name = "User"

    def get_queryset(self):
        qs = (User.objects.select_related("profile", "organization").order_by("-created_at")
              .annotate(active_courses=Count("enrollments", filter=Q(enrollments__status="active"), distinct=True),
                        orders_count=Count("orders", distinct=True)))
        if org := self.request.query_params.get("org"):
            qs = qs.filter(organization__public_id=org)
        return qs

    def create(self, request):
        """Invite a user: they receive an email with a link to set their own password."""
        ser = S.AdminUserCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        from apps.accounts.models import StudentProfile

        staff = d["role"] == User.Role.ADMIN
        user = User.objects.create_user(
            d["email"], None, phone=d.get("phone", ""), role=d["role"],
            status=User.Status.ACTIVE if d["role"] != User.Role.STUDENT else User.Status.PENDING_PAYMENT,
            is_staff=False, organization=d.get("organization"),
        )
        StudentProfile.objects.create(user=user, full_name=d["full_name"])
        if staff:
            user.is_staff = True
            user.save(update_fields=["is_staff"])
        uid, token = tokens.make_reset_token(user)
        emails.queue_email(
            "admin_created", "Your IT DigiTech account is ready", user.email,
            {"name": emails.display_name(user), "reset_url": emails._links(f"/reset-password?uid={uid}&token={token}"),
             "valid_minutes": 60},
        )
        self._log("created", user)
        return Response(S.AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data, status=201)

    def perform_update(self, serializer):
        target = serializer.instance
        if target.pk == self.request.user.pk:
            new = serializer.validated_data
            if new.get("role", target.role) != "admin" or new.get("is_active", True) is False \
                    or new.get("status", target.status) == "suspended":
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"detail": "You cannot remove your own admin access."})
        obj = serializer.save()
        obj.is_staff = obj.role == "admin" or obj.is_superuser
        obj.save(update_fields=["is_staff"])
        self._log("updated", obj)

    @action(detail=True, methods=["get"])
    def overview(self, request, public_id=None):
        """Everything an admin needs to help one student: progress, results, payments."""
        from apps.assessments.models import Attempt
        from apps.catalog.models import Lesson

        user = self.get_object()
        now = timezone.now()
        courses = []
        for e in Enrollment.objects.filter(user=user).select_related("course").order_by("-created_at"):
            total = Lesson.objects.filter(module__course=e.course, is_published=True, is_deleted=False).count()
            qs = LessonProgress.objects.filter(user=user, lesson__module__course=e.course)
            done = qs.filter(completed=True).count()
            last = qs.order_by("-updated_at").first()
            expired = e.status == "expired" or (e.expires_at and e.expires_at <= now)
            courses.append({"course": e.course.title, "state": "revoked" if e.status == "revoked" else "expired" if expired else "active",
                            "progress": round(done * 100 / total) if total else 0, "lessons_done": done, "lessons_total": total,
                            "expires_at": e.expires_at, "last_activity": last.updated_at if last else None})
        attempts = [{"test": a.test.title, "score": a.score, "total": a.total_marks, "passed": a.passed, "when": a.submitted_at or a.started_at}
                    for a in Attempt.objects.filter(user=user).exclude(status="in_progress").select_related("test").order_by("-started_at")[:6]]
        orders = [{"plan": o.plan.name, "total": o.total, "status": o.status, "when": o.paid_at or o.created_at,
                   "source": "offline" if (o.razorpay_order_id or "").startswith("offline_") else "online"}
                  for o in Order.objects.filter(user=user).select_related("plan").order_by("-created_at")[:6]]
        return Response({"courses": courses, "attempts": attempts, "orders": orders,
                         "open_tickets": user.tickets.exclude(status="closed").count()})

    @action(detail=False, methods=["post"], url_path="import", parser_classes=[MultiPartParser, FormParser])
    def import_students(self, request):
        """Create many students from a CSV. Send dry_run=true first to preview."""
        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": "Choose a CSV file."}, status=400)
        course = None
        if c := request.data.get("course"):
            course = get_object_or_404(Course, public_id=c, is_deleted=False)
        org = None
        if o := request.data.get("organization"):
            from apps.organizations.models import Organization
            org = get_object_or_404(Organization, public_id=o)
        truthy = lambda v, d: d if v in (None, "") else str(v).lower() in ("1", "true", "yes", "on")
        result = importers.import_students(
            upload, course=course, organization=org, validity_days=request.data.get("validity_days") or None,
            send_invites=truthy(request.data.get("send_invites"), True), dry_run=truthy(request.data.get("dry_run"), True),
            actor=request.user)
        if not result["dry_run"]:
            AuditLog.objects.create(actor=request.user, action=f"imported {result['created']} students", target_type="User", summary="CSV import")
        return Response(result)

    @action(detail=True, methods=["post"])
    def suspend(self, request, public_id=None):
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response({"detail": "You cannot suspend your own account."}, status=400)
        user.status, user.is_active = User.Status.SUSPENDED, False
        user.save(update_fields=["status", "is_active"])
        auth.revoke_all_sessions(user)
        self._log("suspended", user)
        return Response(S.AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, public_id=None):
        user = self.get_object()
        has_courses = Enrollment.objects.active().filter(user=user).exists()
        user.is_active = True
        user.status = User.Status.ACTIVE if (has_courses or user.role != "student") else User.Status.PENDING_PAYMENT
        user.save(update_fields=["status", "is_active"])
        self._log("reactivated", user)
        return Response(S.AdminUserSerializer(self.get_queryset().get(pk=user.pk)).data)

    @action(detail=True, methods=["post"], url_path="send-reset")
    def send_reset(self, request, public_id=None):
        user = self.get_object()
        uid, token = tokens.make_reset_token(user)
        emails.send_password_reset(user, uid, token)
        self._log("sent password reset to", user)
        return Response({"detail": f"Reset link sent to {user.email}."})

    @action(detail=True, methods=["get", "post"])
    def enrollments(self, request, public_id=None):
        user = self.get_object()
        if request.method == "POST":
            course = get_object_or_404(Course, public_id=request.data.get("course"), is_deleted=False)
            days = request.data.get("validity_days")
            now = timezone.now()
            Enrollment.objects.update_or_create(
                user=user, course=course,
                defaults={"status": Enrollment.Status.ACTIVE, "starts_at": now, "organization": user.organization,
                          "expires_at": now + timedelta(days=int(days)) if days else None},
            )
            if user.status == User.Status.PENDING_PAYMENT:
                user.status = User.Status.ACTIVE
                user.save(update_fields=["status"])
            notify(user, "New course unlocked", f"You now have access to {course.title}.", f"/learn/{course.slug}")
            self._log(f"granted {course.title} to", user)
        rows = Enrollment.objects.filter(user=user).select_related("course").order_by("-created_at")
        return Response([{"course_id": str(e.course.public_id), "course": e.course.title, "status": e.status,
                          "expires_at": e.expires_at} for e in rows])

    @action(detail=True, methods=["post"], url_path="revoke-course")
    def revoke_course(self, request, public_id=None):
        user = self.get_object()
        course = get_object_or_404(Course, public_id=request.data.get("course"))
        Enrollment.objects.filter(user=user, course=course).update(status=Enrollment.Status.REVOKED)
        self._log(f"revoked {course.title} from", user)
        return Response({"detail": "Access removed."})


# --------------------------------------------------------------- catalog
class CourseViewSet(SoftDeleteMixin, AuditedModelViewSet):
    serializer_class = S.AdminCourseSerializer
    filterset_fields = ("is_published", "level")
    search_fields = ("title", "slug")
    ordering_fields = ("title", "created_at")

    def get_queryset(self):
        return (Course.objects.filter(is_deleted=False).order_by("-created_at").annotate(
            modules_count=Count("modules", filter=Q(modules__is_deleted=False), distinct=True),
            lessons_count=Count("modules__lessons", filter=Q(modules__lessons__is_deleted=False), distinct=True),
            enrolled_count=Count("enrollments", filter=Q(enrollments__status="active"), distinct=True)))

    @action(detail=True, methods=["get"])
    def curriculum(self, request, public_id=None):
        course = self.get_object()
        modules = course.modules.filter(is_deleted=False).prefetch_related("lessons__video", "lessons__notes")
        out = []
        for m in modules:
            lessons = [l for l in m.lessons.all() if not l.is_deleted]
            out.append({**S.AdminModuleSerializer(m).data,
                        "lessons": S.AdminLessonSerializer(lessons, many=True).data})
        return Response({"course": S.AdminCourseSerializer(self.get_queryset().get(pk=course.pk)).data, "modules": out})


class ModuleViewSet(ReorderMixin, SoftDeleteMixin, AuditedModelViewSet):
    serializer_class = S.AdminModuleSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Module.objects.filter(is_deleted=False).order_by("order", "id")
        c = self.request.query_params.get("course")
        return qs.filter(course__public_id=c) if c else qs


class LessonViewSet(ReorderMixin, SoftDeleteMixin, AuditedModelViewSet):
    serializer_class = S.AdminLessonSerializer
    pagination_class = None
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = (Lesson.objects.filter(is_deleted=False).select_related("module", "video")
              .prefetch_related("notes").order_by("order", "id"))
        m = self.request.query_params.get("module")
        return qs.filter(module__public_id=m) if m else qs


# ----------------------------------------------------------- assessments
class _TestImport:
    @action(detail=True, methods=["post"], url_path="import-questions", parser_classes=[MultiPartParser, FormParser])
    def import_questions(self, request, public_id=None):
        test = self.get_object()
        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": "Choose a CSV file."}, status=400)
        dry = str(request.data.get("dry_run", "true")).lower() in ("1", "true", "yes", "on")
        result = importers.import_questions(upload, test, dry_run=dry)
        if not dry:
            AuditLog.objects.create(actor=request.user, action=f"imported {result['created']} questions into", target_type="Test",
                                    target_id=str(test.public_id), summary=str(test)[:200])
        return Response(result)


class TestViewSet(_TestImport, AuditedModelViewSet):
    serializer_class = S.AdminTestSerializer
    filterset_fields = ("is_published",)
    search_fields = ("title", "course__title")

    def get_queryset(self):
        qs = (Test.objects.select_related("course").order_by("-created_at")
              .annotate(question_count=Count("questions", distinct=True), attempts_count=Count("attempts", distinct=True)))
        c = self.request.query_params.get("course")
        return qs.filter(course__public_id=c) if c else qs


class QuestionViewSet(ReorderMixin, AuditedModelViewSet):
    serializer_class = S.AdminQuestionSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Question.objects.select_related("test").order_by("order", "id")
        t = self.request.query_params.get("test")
        return qs.filter(test__public_id=t) if t else qs


class AttemptViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = S.AdminAttemptSerializer
    filterset_fields = ("status", "passed")
    search_fields = ("user__email", "test__title")

    def retrieve(self, request, *args, **kwargs):
        """The student's answers next to the correct ones, question by question."""
        attempt = self.get_object()
        answers = {a.question_id: a for a in attempt.answers.all()}
        review = []
        for q in attempt.test.questions.all():
            a = answers.get(q.id)
            review.append({"id": str(q.public_id), "text": q.text, "options": q.options, "marks": q.marks,
                           "your_answer": a.response if a else [], "correct_answer": q.correct_answer,
                           "is_correct": bool(a and a.is_correct), "explanation": q.explanation})
        return Response({**S.AdminAttemptSerializer(attempt).data, "review": review})

    def get_queryset(self):
        qs = Attempt.objects.select_related("user", "test").order_by("-started_at")
        t = self.request.query_params.get("test")
        return qs.filter(test__public_id=t) if t else qs


# --------------------------------------------------------------- billing
class PlanViewSet(AuditedModelViewSet):
    serializer_class = S.AdminPlanSerializer
    filterset_fields = ("is_active", "plan_type")
    search_fields = ("name",)

    def get_queryset(self):
        return Plan.objects.prefetch_related("courses").annotate(orders_count=Count("orders")).order_by("price")

    def perform_destroy(self, instance):
        if instance.orders.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError({"detail": "This plan has orders, so it cannot be deleted. Deactivate it instead."})
        super().perform_destroy(instance)


class CouponViewSet(AuditedModelViewSet):
    serializer_class = S.AdminCouponSerializer
    filterset_fields = ("is_active",)
    search_fields = ("code",)
    queryset = Coupon.objects.order_by("-created_at")


class OrderViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = S.AdminOrderSerializer
    filterset_fields = ("status",)
    search_fields = ("user__email", "plan__name", "razorpay_order_id")
    ordering_fields = ("created_at", "total", "paid_at")

    def get_queryset(self):
        return (Order.objects.select_related("user", "plan", "coupon", "invoice").prefetch_related("payments")
                .order_by("-created_at"))

    @action(detail=True, methods=["get"])
    def invoice(self, request, public_id=None):
        order = self.get_object()
        inv = getattr(order, "invoice", None)
        if not inv or not inv.pdf_file:
            return Response({"detail": "No invoice has been generated for this order yet."}, status=404)
        return FileResponse(inv.pdf_file.open("rb"), as_attachment=True, filename=f"{inv.invoice_number}.pdf",
                            content_type="application/pdf")

    @action(detail=True, methods=["post"], url_path="resend-invoice")
    def resend_invoice(self, request, public_id=None):
        order = self.get_object()
        if order.status != Order.Status.PAID:
            return Response({"detail": "Only paid orders have an invoice."}, status=400)
        if hasattr(order, "invoice") and order.invoice.pdf_file:
            dispatch(resend_invoice_email, order.pk)
            msg = f"Invoice emailed again to {order.user.email}."
        else:
            dispatch(generate_invoice, order.pk)  # creates the PDF and emails it
            msg = f"Invoice is being generated and will be emailed to {order.user.email}."
        AuditLog.objects.create(actor=request.user, action="re-sent an invoice for", target_type="Order",
                                target_id=str(order.public_id), summary=str(order)[:200])
        return Response({"detail": msg})


# ------------------------------------------------------ content + config
class FAQViewSet(AuditedModelViewSet):
    serializer_class = S.AdminFAQSerializer
    search_fields = ("question", "answer")
    queryset = FAQ.objects.all()


class AnnouncementViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin,
                          viewsets.GenericViewSet):
    serializer_class = S.AdminAnnouncementSerializer
    queryset = Announcement.objects.all()

    def perform_create(self, serializer):
        a = serializer.save(created_by=self.request.user)
        self._log("published announcement", a)
        dispatch(broadcast_announcement, a.pk)  # fan-out happens in a Celery worker


class FeatureFlagViewSet(AuditedModelViewSet):
    serializer_class = S.FeatureFlagSerializer
    pagination_class = None
    queryset = FeatureFlag.objects.order_by("key")


class SiteSettingViewSet(AuditedModelViewSet):
    serializer_class = S.SiteSettingSerializer
    pagination_class = None
    queryset = SiteSetting.objects.order_by("key")


class AuditLogViewSet(AdminBase, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = S.AuditLogSerializer
    search_fields = ("action", "target_type", "summary", "actor__email")
    queryset = AuditLog.objects.select_related("actor")


class EmailLogViewSet(AdminBase, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = S.EmailLogSerializer
    filterset_fields = ("status", "template")
    search_fields = ("to", "subject")
    queryset = EmailLog.objects.all()


class ExportViewSet(AdminBase, mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = S.ExportJobSerializer
    pagination_class = None

    def get_queryset(self):
        return ExportJob.objects.filter(requested_by=self.request.user)[:20]

    def create(self, request):
        from apps.notifications.tasks import EXPORTS

        kind = request.data.get("kind")
        if kind not in EXPORTS:
            return Response({"detail": f"Choose one of: {', '.join(EXPORTS)}."}, status=400)
        job = ExportJob.objects.create(kind=kind, requested_by=request.user)
        dispatch(generate_export, job.pk)
        job.refresh_from_db()
        self._log(f"requested {kind} export", job)
        return Response(S.ExportJobSerializer(job).data, status=status.HTTP_202_ACCEPTED)


# --------------------------------------------------------------- support
class TicketViewSet(AdminBase, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = TicketSerializer
    filterset_fields = ("status", "priority", "category")
    search_fields = ("subject", "user__email", "user__profile__full_name")
    ordering_fields = ("last_message_at", "created_at", "priority")
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        qs = Ticket.objects.select_related("user", "user__profile", "assigned_to").prefetch_related("messages")
        p = self.request.query_params
        a = p.get("assigned")
        if a == "me":
            qs = qs.filter(assigned_to=self.request.user)
        elif a == "unassigned":
            qs = qs.filter(assigned_to__isnull=True)
        if p.get("unread") == "1":
            qs = qs.filter(unread_by_staff=True)
        if p.get("status") == "active":
            qs = qs.exclude(status__in=[Ticket.Status.CLOSED, Ticket.Status.RESOLVED])
        return qs

    def filter_queryset(self, queryset):
        # "status=active" is our own value, not a model choice, so skip the choice filter for it
        if self.request.query_params.get("status") == "active":
            filters = [b for b in self.filter_backends if b is not DjangoFilterBackend]
            for b in filters:
                queryset = b().filter_queryset(self.request, queryset, self)
            return queryset
        return super().filter_queryset(queryset)

    def _detail(self, ticket):
        user = ticket.user
        profile = getattr(user, "profile", None)
        return {
            **TicketSerializer(ticket).data,
            "student": {"id": str(user.public_id), "email": user.email, "name": getattr(profile, "full_name", "") or user.email,
                        "phone": user.phone, "status": user.status},
            "assigned_to": ({"id": str(ticket.assigned_to.public_id), "email": ticket.assigned_to.email}
                            if ticket.assigned_to else None),
            "unread_by_staff": ticket.unread_by_staff,
        }

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        rows = resp.data["results"]
        by_id = {str(t.public_id): t for t in self.paginator.page}
        for r in rows:
            t = by_id[r["id"]]
            r["student"] = getattr(getattr(t.user, "profile", None), "full_name", "") or t.user.email
            r["student_email"] = t.user.email
            r["assigned_to"] = t.assigned_to.email if t.assigned_to else None
            r["unread"] = t.unread_by_staff
        return resp

    def retrieve(self, request, *args, **kwargs):
        ticket = self.get_object()
        support.mark_read(ticket, staff=True)
        return Response({**self._detail(ticket), "messages": thread(ticket, request, include_internal=True)})

    def partial_update(self, request, *args, **kwargs):
        ticket = self.get_object()
        assignee = "__keep__"
        if "assigned_to" in request.data:
            v = request.data["assigned_to"]
            assignee = None if not v else get_object_or_404(User, public_id=v, role="admin")
        valid_status = {c for c, _ in Ticket.Status.choices}
        valid_prio = {c for c, _ in Ticket.Priority.choices}
        st, pr = request.data.get("status"), request.data.get("priority")
        if (st and st not in valid_status) or (pr and pr not in valid_prio):
            return Response({"detail": "Unknown status or priority."}, status=400)
        support.update_ticket(ticket, status=st, priority=pr, assigned_to=assignee)
        self._log("updated", ticket)
        return Response(self._detail(ticket))

    @action(detail=True, methods=["post"])
    def reply(self, request, public_id=None):
        ticket = self.get_object()
        ser = ReplySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        internal = str(request.data.get("internal", "")).lower() in ("1", "true", "yes")
        msg = support.add_message(ticket, request.user, ser.validated_data["body"], staff=True, internal=internal,
                                  attachment=ser.validated_data.get("attachment"))
        if not internal and ticket.assigned_to is None:
            support.update_ticket(ticket, assigned_to=request.user)  # first responder owns it
        if not internal and ticket.status == Ticket.Status.WAITING and request.data.get("resolve"):
            support.update_ticket(ticket, status=Ticket.Status.RESOLVED)
        return Response(support.message_payload(msg, request), status=201)

    @action(detail=False, methods=["get"])
    def counts(self, request):
        qs = Ticket.objects.exclude(status=Ticket.Status.CLOSED)
        out = {s: Ticket.objects.filter(status=s).count() for s, _ in Ticket.Status.choices}
        out.update(mine=qs.filter(assigned_to=request.user).count(), unassigned=qs.filter(assigned_to__isnull=True).count(),
                   unread=qs.filter(unread_by_staff=True).count())
        return Response(out)


class StaffListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = User.objects.filter(role="admin", is_active=True).select_related("profile")
        return Response([{"id": str(u.public_id), "email": u.email,
                          "name": getattr(getattr(u, "profile", None), "full_name", "") or u.email} for u in qs])
