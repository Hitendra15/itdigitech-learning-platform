from django.utils import timezone
from rest_framework import serializers

from apps.billing.models import Coupon

from . import schemas, services
from .models import HomeSection, MediaAsset, PromoBanner


def _clean_text(value, limit):
    return " ".join(schemas._CTRL.sub("", value or "").split())[:limit]


# ------------------------------------------------------------------ media
class MediaSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    url = serializers.SerializerMethodField()
    in_use = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    image = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = MediaAsset
        fields = ("id", "name", "image", "url", "width", "height", "size_bytes", "alt_text", "in_use", "uploaded_by_name", "created_at")
        read_only_fields = ("name", "width", "height", "size_bytes")

    def get_url(self, obj):
        return obj.image.url

    def get_in_use(self, obj):
        return self.context.get("usage", {}).get(str(obj.public_id), 0)

    def get_uploaded_by_name(self, obj):
        u = obj.uploaded_by
        return (getattr(getattr(u, "profile", None), "full_name", "") or getattr(u, "email", "")) if u else ""

    def validate_alt_text(self, v):
        return _clean_text(v, 200)


class MediaUploadSerializer(serializers.Serializer):
    image = serializers.FileField()
    alt_text = serializers.CharField(required=False, allow_blank=True, max_length=200)


# ------------------------------------------------------------------ homepage sections
class SectionSerializer(serializers.ModelSerializer):
    """What the console shows: live values with any unpublished draft laid on top."""

    id = serializers.UUIDField(source="public_id", read_only=True)
    type_label = serializers.SerializerMethodField()
    order = serializers.SerializerMethodField()
    is_enabled = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()
    has_draft = serializers.BooleanField(read_only=True)
    live_enabled = serializers.BooleanField(source="is_enabled", read_only=True)

    class Meta:
        model = HomeSection
        fields = ("id", "section_type", "type_label", "label", "order", "is_enabled", "live_enabled", "content", "has_draft", "published_at")

    def _e(self, obj):
        return obj.effective(preview=True)

    def get_type_label(self, obj):
        return schemas.SECTION_TYPES[obj.section_type]["label"]

    def get_order(self, obj):
        return self._e(obj)["order"]

    def get_is_enabled(self, obj):
        return self._e(obj)["is_enabled"]

    def get_content(self, obj):
        return self._e(obj)["content"]

    def get_label(self, obj):
        return self._e(obj)["label"] or self.get_type_label(obj)


class SectionWriteSerializer(serializers.Serializer):
    section_type = serializers.ChoiceField(choices=list(schemas.SECTION_TYPES), required=False)
    label = serializers.CharField(required=False, allow_blank=True, max_length=80)
    is_enabled = serializers.BooleanField(required=False)
    content = serializers.DictField(required=False)

    def validate(self, attrs):
        inst = self.context.get("instance")
        stype = inst.section_type if inst else attrs.get("section_type")
        if not inst and not stype:
            raise serializers.ValidationError({"section_type": "Choose what kind of section to add."})
        if "content" in attrs:
            attrs["content"] = schemas.clean_content(stype, attrs["content"])
        if "label" in attrs:
            attrs["label"] = _clean_text(attrs["label"], 80)
        if not inst and schemas.SECTION_TYPES[stype]["singleton"] and HomeSection.objects.filter(section_type=stype).exists():
            raise serializers.ValidationError({"section_type": f"The homepage already has a “{schemas.SECTION_TYPES[stype]['label']}” section. Edit that one instead."})
        return attrs


# ------------------------------------------------------------------ promotions
class PromoSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    desktop_image = serializers.SlugRelatedField(slug_field="public_id", queryset=MediaAsset.objects.all(), required=False, allow_null=True)
    mobile_image = serializers.SlugRelatedField(slug_field="public_id", queryset=MediaAsset.objects.all(), required=False, allow_null=True)
    coupon = serializers.SlugRelatedField(slug_field="public_id", queryset=Coupon.objects.all(), required=False, allow_null=True)
    desktop_image_url = serializers.SerializerMethodField()
    mobile_image_url = serializers.SerializerMethodField()
    coupon_code = serializers.CharField(source="coupon.code", read_only=True, default=None)
    coupon_percent = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    warnings = serializers.SerializerMethodField()

    class Meta:
        model = PromoBanner
        fields = ("id", "name", "title", "description", "badge_text", "cta_label", "cta_url", "desktop_image", "mobile_image",
                  "desktop_image_url", "mobile_image_url", "placements", "theme", "coupon", "coupon_code", "coupon_percent",
                  "show_countdown", "starts_at", "ends_at", "is_active", "priority", "status", "warnings", "created_at", "updated_at")
        extra_kwargs = {"title": {"max_length": 120}}

    def get_desktop_image_url(self, o):
        return o.desktop_image.image.url if o.desktop_image_id else None

    def get_mobile_image_url(self, o):
        return o.mobile_image.image.url if o.mobile_image_id else None

    def get_coupon_percent(self, o):
        return float(o.coupon.percent_off) if o.coupon_id else None

    def get_status(self, o):
        return o.status()

    def get_warnings(self, o):
        w, now = [], timezone.now()
        if o.coupon_id and not o.coupon.is_valid():
            w.append("The linked coupon is inactive, expired or used up, so this promotion will stay hidden until that is fixed.")
        elif o.coupon_id and o.coupon.valid_to and o.ends_at and o.coupon.valid_to < o.ends_at:
            w.append("The coupon expires before this promotion ends. Visitors would see a code that stops working.")
        if o.is_active and not o.ends_at:
            w.append("No end date is set. It stays live until you deactivate it.")
        if o.is_active and o.ends_at and o.ends_at > now and o.cta_label and not o.cta_url:
            w.append("The button has text but no link.")
        return w

    # -- validation
    def validate_name(self, v):
        v = _clean_text(v, 120)
        if not v:
            raise serializers.ValidationError("Give the promotion an internal name.")
        return v

    def validate_title(self, v):
        v = _clean_text(v, 120)
        if not v:
            raise serializers.ValidationError("Enter the headline visitors will see.")
        return v

    def validate_description(self, v):
        return _clean_text(v, 240)

    def validate_badge_text(self, v):
        return _clean_text(v, 24)

    def validate_cta_label(self, v):
        return _clean_text(v, 40)

    def validate_cta_url(self, v):
        try:
            return schemas.clean_url(v or "")
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))

    def validate_placements(self, v):
        valid = {k for k, _ in schemas.PLACEMENTS}
        if not isinstance(v, list) or not v or any(p not in valid for p in v):
            raise serializers.ValidationError("Choose at least one place for the promotion to appear.")
        return [p for p in dict.fromkeys(v)]

    def validate(self, attrs):
        inst = self.instance
        get = lambda k, d=None: attrs.get(k, getattr(inst, k, d) if inst else d)  # noqa: E731
        start, end, active = get("starts_at"), get("ends_at"), get("is_active", False)
        if start and end and end <= start:
            raise serializers.ValidationError({"ends_at": "The end date must be after the start date."})
        changed = inst is None or any(k in attrs and attrs[k] != getattr(inst, k) for k in ("ends_at", "is_active"))
        if active and end and end <= timezone.now() and changed:
            raise serializers.ValidationError({"ends_at": "This end date has already passed. Choose a future date or turn the promotion off."})
        if get("show_countdown") and not end:
            raise serializers.ValidationError({"show_countdown": "A countdown needs an end date."})
        if get("cta_label") and not get("cta_url"):
            raise serializers.ValidationError({"cta_url": "Add a link for the button, or clear the button text."})
        if "placements" not in attrs and not inst:
            raise serializers.ValidationError({"placements": "Choose at least one place for the promotion to appear."})
        return attrs
