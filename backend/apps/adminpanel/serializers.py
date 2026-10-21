from django.utils.text import slugify
from rest_framework import serializers

from apps.accounts.models import StudentProfile, User
from apps.assessments.models import Attempt, Question, Test
from apps.billing.models import Coupon, Order, Payment, Plan
from apps.catalog.models import Course, Lesson, Module, Note, VideoAsset
from apps.notifications.models import Announcement, EmailLog, ExportJob
from apps.organizations.models import Organization
from apps.platform_config.models import FeatureFlag, SiteSetting
from apps.support.models import FAQ

from .models import AuditLog


class PublicIdModelSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)


def by_public_id(model, **kw):
    return serializers.SlugRelatedField(slug_field="public_id", queryset=model.objects.all(), **kw)


# ---------------------------------------------------------------- users
class AdminUserSerializer(PublicIdModelSerializer):
    full_name = serializers.CharField(source="profile.full_name", required=False, allow_blank=True)
    college_name = serializers.CharField(source="profile.college_name", required=False, allow_blank=True)
    active_courses = serializers.IntegerField(read_only=True, default=0)
    orders_count = serializers.IntegerField(read_only=True, default=0)
    organization = by_public_id(Organization, required=False, allow_null=True)
    organization_name = serializers.CharField(source="organization.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "college_name", "phone", "role", "status", "is_active",
                  "is_email_verified", "created_at", "last_login", "active_courses", "orders_count",
                  "organization", "organization_name")
        read_only_fields = ("email", "created_at", "last_login")

    def update(self, instance, validated):
        profile = validated.pop("profile", {})
        for k, v in validated.items():
            setattr(instance, k, v)
        instance.save()
        if profile:
            p, _ = StudentProfile.objects.get_or_create(user=instance, defaults={"full_name": instance.email})
            for k, v in profile.items():
                setattr(p, k, v)
            p.save()
        return instance


class AdminUserCreateSerializer(serializers.Serializer):
    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=15, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, default=User.Role.STUDENT)
    organization = by_public_id(Organization, required=False, allow_null=True)

    def validate_email(self, v):
        v = v.lower()
        if User.objects.filter(email=v).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return v


# -------------------------------------------------------------- catalog
class AdminCourseSerializer(PublicIdModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    modules_count = serializers.IntegerField(read_only=True, default=0)
    lessons_count = serializers.IntegerField(read_only=True, default=0)
    enrolled_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Course
        fields = ("id", "title", "slug", "description", "level", "is_published", "rule_config",
                  "modules_count", "lessons_count", "enrolled_count", "created_at")

    def validate(self, attrs):
        slug = attrs.get("slug") or ((slugify(attrs.get("title", "")) or "course") if not self.instance else None)
        if slug:
            qs = Course.objects.filter(slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                if attrs.get("slug"):
                    raise serializers.ValidationError({"slug": "This slug is already used by another course."})
                n = 2
                while Course.objects.filter(slug=f"{slug}-{n}").exists():
                    n += 1
                slug = f"{slug}-{n}"
            attrs["slug"] = slug
        return attrs


class AdminModuleSerializer(PublicIdModelSerializer):
    course = by_public_id(Course)

    class Meta:
        model = Module
        fields = ("id", "course", "title", "order", "is_published")


class AdminLessonSerializer(PublicIdModelSerializer):
    module = by_public_id(Module)
    video_path = serializers.CharField(required=False, allow_blank=True)
    note_content = serializers.CharField(required=False, allow_blank=True)
    note_file = serializers.FileField(write_only=True, required=False, allow_null=True)
    clear_note_file = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Lesson
        fields = ("id", "module", "title", "lesson_type", "order", "duration_seconds", "is_free_preview",
                  "is_published", "video_path", "note_content", "note_file", "clear_note_file")

    def validate_video_path(self, v):
        """Admins paste whatever their video library shows: a full link or a path. Store just the path."""
        from urllib.parse import urlparse

        from django.conf import settings

        v = (v or "").strip()
        if not v:
            return ""
        if v.startswith(("http://", "https://")):
            u = urlparse(v)
            host = urlparse(settings.VIDEO_CDN_HOST).netloc if settings.VIDEO_CDN_HOST else ""
            if host and u.netloc != host:
                raise serializers.ValidationError(f"This link is not from your video library ({host}).")
            v = u.path
        return v if v.startswith("/") else f"/{v}"

    def validate_note_file(self, f):
        import os

        if f is None:
            return f
        if os.path.splitext(f.name)[1].lower() not in {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".zip"}:
            raise serializers.ValidationError("Upload a PDF, Word, PowerPoint, text or ZIP file.")
        if f.size > 15 * 1024 * 1024:
            raise serializers.ValidationError("Files can be up to 15 MB.")
        return f

    def to_representation(self, obj):
        data = super().to_representation(obj)
        video = getattr(obj, "video", None)
        data["video_path"] = video.provider_path if video else ""
        note = obj.notes.first()
        data["note_content"] = note.content if note else ""
        data["note_file_url"] = note.file.url if note and note.file else None
        data["note_file_name"] = note.file.name.rsplit("/", 1)[-1] if note and note.file else None
        return data

    def _save_extras(self, lesson, video_path, note_content, note_file=None, clear_file=False):
        if video_path is not None:
            if video_path:
                VideoAsset.objects.update_or_create(lesson=lesson, defaults={"provider_path": video_path})
            else:
                VideoAsset.objects.filter(lesson=lesson).delete()
        if note_content is None and note_file is None and not clear_file:
            return
        note = lesson.notes.first() or Note(lesson=lesson, title="Lesson notes")
        if note_content is not None:
            note.content = note_content
        if clear_file and note.pk and note.file:
            note.file.delete(save=False)
        if note_file:
            note.file = note_file
        if not note.content and not note.file:
            if note.pk:
                note.delete()
            return
        note.save()

    def create(self, validated):
        extras = (validated.pop("video_path", None), validated.pop("note_content", None),
                  validated.pop("note_file", None), validated.pop("clear_note_file", False))
        lesson = super().create(validated)
        self._save_extras(lesson, *extras)
        return lesson

    def update(self, instance, validated):
        extras = (validated.pop("video_path", None), validated.pop("note_content", None),
                  validated.pop("note_file", None), validated.pop("clear_note_file", False))
        lesson = super().update(instance, validated)
        self._save_extras(lesson, *extras)
        return lesson


# ----------------------------------------------------------- assessments
class AdminTestSerializer(PublicIdModelSerializer):
    course = by_public_id(Course)
    module = by_public_id(Module, required=False, allow_null=True)
    question_count = serializers.IntegerField(read_only=True, default=0)
    attempts_count = serializers.IntegerField(read_only=True, default=0)
    course_title = serializers.CharField(source="course.title", read_only=True)

    class Meta:
        model = Test
        fields = ("id", "course", "course_title", "module", "title", "duration_minutes", "pass_percent",
                  "max_attempts", "is_published", "question_count", "attempts_count", "created_at")

    def validate_pass_percent(self, v):
        if not 1 <= v <= 100:
            raise serializers.ValidationError("Pass percentage must be between 1 and 100.")
        return v

    def validate(self, attrs):
        module, course = attrs.get("module"), attrs.get("course") or getattr(self.instance, "course", None)
        if module and course and module.course_id != course.pk:
            raise serializers.ValidationError({"module": "This module belongs to a different course."})
        return attrs


class AdminQuestionSerializer(PublicIdModelSerializer):
    test = by_public_id(Test)

    class Meta:
        model = Question
        fields = ("id", "test", "text", "options", "correct_answer", "explanation", "marks", "order")

    def validate_options(self, opts):
        if not isinstance(opts, list) or len(opts) < 2:
            raise serializers.ValidationError("Add at least two answer options.")
        ids = []
        for o in opts:
            if not isinstance(o, dict) or not str(o.get("id", "")).strip() or not str(o.get("text", "")).strip():
                raise serializers.ValidationError("Every option needs an id and some text.")
            ids.append(str(o["id"]))
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("Option ids must be unique.")
        return opts

    def validate(self, attrs):
        opts = attrs.get("options", getattr(self.instance, "options", []))
        correct = attrs.get("correct_answer", getattr(self.instance, "correct_answer", []))
        if not correct:
            raise serializers.ValidationError({"correct_answer": "Mark at least one correct answer."})
        valid = {str(o["id"]) for o in opts}
        if not {str(c) for c in correct} <= valid:
            raise serializers.ValidationError({"correct_answer": "Correct answers must be among the options."})
        if attrs.get("marks", 1) < 1:
            raise serializers.ValidationError({"marks": "Marks must be at least 1."})
        return attrs


class AdminAttemptSerializer(PublicIdModelSerializer):
    student = serializers.CharField(source="user.email", read_only=True)
    test_title = serializers.CharField(source="test.title", read_only=True)

    class Meta:
        model = Attempt
        fields = ("id", "student", "test_title", "started_at", "submitted_at", "score", "total_marks", "passed", "status")


# --------------------------------------------------------------- billing
class AdminPlanSerializer(PublicIdModelSerializer):
    courses = by_public_id(Course, many=True, required=False)
    orders_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Plan
        fields = ("id", "name", "plan_type", "courses", "include_all_courses", "price", "gst_percent",
                  "validity_days", "is_active", "orders_count")

    def validate_price(self, v):
        if v <= 0:
            raise serializers.ValidationError("Price must be greater than zero.")
        return v


class AdminCouponSerializer(PublicIdModelSerializer):
    class Meta:
        model = Coupon
        fields = ("id", "code", "percent_off", "flat_off", "valid_from", "valid_to", "max_uses", "used_count", "is_active")
        read_only_fields = ("used_count",)

    def validate_code(self, v):
        v = v.strip().upper()
        qs = Coupon.objects.filter(code__iexact=v)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A coupon with this code already exists.")
        return v

    def validate(self, attrs):
        pct = attrs.get("percent_off", getattr(self.instance, "percent_off", 0))
        flat = attrs.get("flat_off", getattr(self.instance, "flat_off", 0))
        if not 0 <= pct <= 100:
            raise serializers.ValidationError({"percent_off": "Percentage must be between 0 and 100."})
        if pct == 0 and flat == 0:
            raise serializers.ValidationError({"percent_off": "Set a percentage or a flat amount."})
        a, b = attrs.get("valid_from"), attrs.get("valid_to")
        if a and b and b <= a:
            raise serializers.ValidationError({"valid_to": "The end date must be after the start date."})
        return attrs


class AdminPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ("razorpay_payment_id", "method", "status", "amount", "error_description", "created_at")


class AdminOrderSerializer(PublicIdModelSerializer):
    student = serializers.CharField(source="user.email", read_only=True)
    plan_name = serializers.CharField(source="plan.name", read_only=True)
    coupon_code = serializers.CharField(source="coupon.code", read_only=True, default=None)
    payments = AdminPaymentSerializer(many=True, read_only=True)
    invoice_number = serializers.SerializerMethodField()
    source = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ("id", "student", "plan_name", "coupon_code", "subtotal", "discount", "tax", "total", "status",
                  "razorpay_order_id", "paid_at", "created_at", "payments", "invoice_number", "source")

    def get_source(self, obj):
        return "offline" if (obj.razorpay_order_id or "").startswith("offline_") else "online"

    def get_invoice_number(self, obj):
        inv = getattr(obj, "invoice", None)
        return inv.invoice_number if inv else None


# ------------------------------------------------------- content, config
class AdminFAQSerializer(PublicIdModelSerializer):
    class Meta:
        model = FAQ
        fields = ("id", "question", "answer", "category", "order", "is_published")


class AdminAnnouncementSerializer(PublicIdModelSerializer):
    class Meta:
        model = Announcement
        fields = ("id", "title", "body", "audience", "send_email", "status", "recipients", "sent_at", "created_at")
        read_only_fields = ("status", "recipients", "sent_at", "created_at")


class FeatureFlagSerializer(PublicIdModelSerializer):
    class Meta:
        model = FeatureFlag
        fields = ("id", "key", "enabled", "description")


class SiteSettingSerializer(PublicIdModelSerializer):
    class Meta:
        model = SiteSetting
        fields = ("id", "key", "value", "description")


class AuditLogSerializer(PublicIdModelSerializer):
    actor = serializers.CharField(source="actor.email", default="system", read_only=True)

    class Meta:
        model = AuditLog
        fields = ("id", "actor", "action", "target_type", "target_id", "summary", "created_at")


class EmailLogSerializer(PublicIdModelSerializer):
    class Meta:
        model = EmailLog
        fields = ("id", "to", "subject", "template", "status", "error", "created_at")


class ExportJobSerializer(PublicIdModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ExportJob
        fields = ("id", "kind", "status", "row_count", "url", "error", "created_at")

    def get_url(self, obj):
        return obj.file.url if obj.file else None
