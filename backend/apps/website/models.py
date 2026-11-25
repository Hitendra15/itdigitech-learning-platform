import os
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from common.models import BaseModel

from .schemas import PLACEMENTS, SECTION_TYPES, THEMES


def media_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    return f"site/{timezone.now():%Y/%m}/{uuid.uuid4().hex}{ext}"


class MediaAsset(BaseModel):
    """An image in the website media library. Referenced by id from sections, promotions and the profile."""

    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to=media_path, width_field="width", height_field="height", max_length=300)
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    size_bytes = models.PositiveIntegerField(default=0)
    alt_text = models.CharField(max_length=200, blank=True, help_text="Describes the image for screen readers and search engines.")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


class HomeSection(BaseModel):
    """
    One block of the homepage. `content`, `is_enabled` and `order` are what visitors see.
    Edits made in the console go to `draft` first and only replace the live values on publish.
    """

    section_type = models.CharField(max_length=30, choices=[(k, v["label"]) for k, v in SECTION_TYPES.items()])
    label = models.CharField(max_length=80, blank=True, help_text="Name shown in the console. Defaults to the section type.")
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_enabled = models.BooleanField(default=True)
    content = models.JSONField(default=dict, blank=True)
    draft = models.JSONField(null=True, blank=True, help_text="Unpublished changes: any of content, is_enabled, order.")
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return self.label or SECTION_TYPES[self.section_type]["label"]

    @property
    def has_draft(self):
        return bool(self.draft)

    def effective(self, preview=False):
        """The values to show: live ones, or live overlaid with the draft when previewing."""
        d = (self.draft or {}) if preview else {}
        return {
            "order": d.get("order", self.order),
            "is_enabled": d.get("is_enabled", self.is_enabled),
            "content": d.get("content", self.content),
            "label": d.get("label", self.label),
        }

    def stage(self, **changes):
        draft = dict(self.draft or {})
        draft.update({k: v for k, v in changes.items() if v is not None})
        self.draft = draft
        self.save(update_fields=["draft", "updated_at"])

    def publish(self):
        d = self.draft or {}
        if "content" in d:
            self.content = d["content"]
        if "is_enabled" in d:
            self.is_enabled = d["is_enabled"]
        if "order" in d:
            self.order = d["order"]
        if "label" in d:
            self.label = d["label"]
        self.draft = None
        self.published_at = timezone.now()
        self.save()


class PromoBanner(BaseModel):
    """A scheduled promotion. Nothing about any specific campaign lives in code: it is all data."""

    name = models.CharField(max_length=120, help_text="Internal name, for example “Year-end sale”. Visitors never see this.")
    title = models.CharField(max_length=120)
    description = models.CharField(max_length=240, blank=True)
    badge_text = models.CharField(max_length=24, blank=True)
    cta_label = models.CharField(max_length=40, blank=True)
    cta_url = models.CharField(max_length=300, blank=True)
    desktop_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    mobile_image = models.ForeignKey(MediaAsset, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    placements = models.JSONField(default=list)
    theme = models.CharField(max_length=10, choices=THEMES, default="brand")
    coupon = models.ForeignKey("billing.Coupon", null=True, blank=True, on_delete=models.SET_NULL, related_name="+",
                               help_text="Optional. Its code and percentage are shown, and the banner hides itself if the coupon stops being valid.")
    show_countdown = models.BooleanField(default=False)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False)
    priority = models.IntegerField(default=0, help_text="When several promotions are live, the highest number wins.")

    class Meta:
        ordering = ("-priority", "-created_at")
        indexes = [models.Index(fields=["is_active", "starts_at", "ends_at"])]

    def __str__(self):
        return self.name

    # ---- scheduling
    def status(self, now=None):
        now = now or timezone.now()
        if not self.is_active:
            return "draft"
        if self.ends_at and self.ends_at <= now:
            return "ended"
        if self.starts_at and self.starts_at > now:
            return "scheduled"
        if self.coupon_id and not self.coupon.is_valid():
            return "coupon_invalid"
        return "live"

    def is_live(self, now=None):
        return self.status(now) == "live"

    @classmethod
    def live(cls, placement=None, now=None):
        now = now or timezone.now()
        qs = (cls.objects.filter(is_active=True).exclude(ends_at__lte=now).exclude(starts_at__gt=now)
              .select_related("coupon", "desktop_image", "mobile_image"))
        rows = [b for b in qs if b.is_live(now)]
        return [b for b in rows if not placement or placement in b.placements]
