import io
import json
from pathlib import Path

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework import serializers

from apps.platform_config.models import SiteSetting

from . import schemas
from .defaults import DEFAULT_PROFILE, DEFAULT_SECTIONS
from .models import HomeSection, MediaAsset, PromoBanner

PROFILE_KEY = "website-profile"
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
MAX_PIXELS = 36_000_000
MAX_EDGE = 2400


# ------------------------------------------------------------------ media
def process_upload(upload):
    """Validate an uploaded image and return (ContentFile, extension, (width, height)). SVG and animated GIF are refused on purpose."""
    max_mb = getattr(settings, "WEBSITE_MAX_IMAGE_MB", 5)
    if upload.size > max_mb * 1024 * 1024:
        raise serializers.ValidationError({"image": [f"Images can be up to {max_mb} MB. This one is {upload.size / 1024 / 1024:.1f} MB."]})
    try:
        probe = Image.open(upload)
        probe.verify()
        upload.seek(0)
        img = Image.open(upload)
        fmt = img.format
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise serializers.ValidationError({"image": ["This file is not a valid image. Upload a JPG, PNG or WebP."]})
    if fmt not in ALLOWED_FORMATS:
        raise serializers.ValidationError({"image": ["Upload a JPG, PNG or WebP image."]})
    if img.width * img.height > MAX_PIXELS:
        raise serializers.ValidationError({"image": ["This image is too large. Resize it to under 6000 × 6000 pixels."]})
    img = ImageOps.exif_transpose(img)
    img.load()
    if max(img.size) > MAX_EDGE:
        img.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    elif fmt == "PNG":
        img.save(buf, "PNG", optimize=True)
    else:
        img.save(buf, "WEBP", quality=85, method=4)
    return ContentFile(buf.getvalue()), ALLOWED_FORMATS[fmt], img.size


def create_asset(upload, user, alt_text="", name=""):
    content, ext, (width, height) = process_upload(upload)
    stem = Path(name or upload.name).stem[:120] or "image"
    asset = MediaAsset(name=f"{stem}{ext}", alt_text=alt_text[:200], uploaded_by=user, size_bytes=content.size)
    asset.image.save(f"{stem}{ext}", content, save=False)
    asset.width, asset.height = width, height  # after save(): Django resets these to None while attaching the file
    asset.save()
    return asset


def asset_usage(asset):
    """Where an image is used: [{type, id, label}]. Used to refuse deleting images that are still live."""
    pid, uses = str(asset.public_id), []
    for p in PromoBanner.objects.filter(desktop_image=asset) | PromoBanner.objects.filter(mobile_image=asset):
        uses.append({"type": "promotion", "id": str(p.public_id), "label": p.name})
    for s in HomeSection.objects.all():
        if pid in json.dumps([s.content, s.draft or {}]):
            uses.append({"type": "section", "id": str(s.public_id), "label": str(s)})
    if pid in json.dumps(get_profile(raw=True)):
        uses.append({"type": "profile", "id": "profile", "label": "Company profile"})
    return uses


# ------------------------------------------------------------------ profile
def get_profile(raw=False):
    stored = SiteSetting.objects.filter(key=PROFILE_KEY).values_list("value", flat=True).first() or {}
    merged = {**DEFAULT_PROFILE, **{k: v for k, v in stored.items() if k in DEFAULT_PROFILE}}
    if raw:
        return merged
    try:  # the raw JSON screen can store anything; never let bad data break the public site
        cleaned = schemas.clean_fields(schemas.PROFILE_FIELDS, merged)
    except serializers.ValidationError:
        cleaned = DEFAULT_PROFILE
    (out,), _ = schemas.resolve_many([(schemas.PROFILE_FIELDS, cleaned)])
    return out


def save_profile(data):
    cleaned = schemas.clean_fields(schemas.PROFILE_FIELDS, data)
    obj, _ = SiteSetting.objects.get_or_create(key=PROFILE_KEY, defaults={"description": "Company details and SEO for the public website"})
    obj.value = cleaned
    obj.save()
    return cleaned


# ------------------------------------------------------------------ promotions
def promo_payload(b):
    """Public shape of a promotion. Only what visitors may see."""
    coupon = None
    if b.coupon_id:
        coupon = {"code": b.coupon.code, "percent_off": float(b.coupon.percent_off), "flat_off": float(b.coupon.flat_off)}
    img = lambda a: schemas.asset_payload(a) if a else None  # noqa: E731
    return {
        "id": str(b.public_id), "title": b.title, "description": b.description, "badge_text": b.badge_text,
        "cta_label": b.cta_label, "cta_url": b.cta_url, "theme": b.theme, "placements": b.placements,
        "desktop_image": img(b.desktop_image), "mobile_image": img(b.mobile_image),
        "ends_at": b.ends_at.isoformat() if (b.show_countdown and b.ends_at) else None,
        "coupon": coupon,
    }


def live_promotions(placement=None):
    return [promo_payload(b) for b in sorted(PromoBanner.live(placement), key=lambda b: (-b.priority, -(b.starts_at.timestamp() if b.starts_at else 0)))]


# ------------------------------------------------------------------ homepage
def _visible(section_type, content, promos):
    """A section with nothing to show is dropped, so the page never has empty gaps."""
    if section_type == "promo":
        return bool(promos)
    if section_type in ("stats", "testimonials", "highlights", "support") and not content.get("items"):
        return False
    if section_type == "showcase" and not content.get("items"):
        return False
    return True


def home_payload(preview=False):
    sections = list(HomeSection.objects.all())
    eff = sorted(((s, s.effective(preview)) for s in sections), key=lambda p: (p[1]["order"], p[0].id))
    promos = live_promotions("home_section")
    keep = [(s, e) for s, e in eff if (e["is_enabled"] or False) and s.section_type in schemas.SECTION_TYPES]
    resolved, _ = schemas.resolve_many([(schemas.SECTION_TYPES[s.section_type]["fields"], e["content"] or {}) for s, e in keep])
    out = []
    for (s, e), content in zip(keep, resolved):
        if not _visible(s.section_type, content, promos):
            continue
        item = {"id": str(s.public_id), "type": s.section_type, "content": content}
        if s.section_type == "promo":
            item["promotion"] = promos[0]
        out.append(item)
    profile = get_profile()
    return {"sections": out, "seo": {"title": profile["seo_title"], "description": profile["seo_description"], "image": profile["og_image"]}}


def site_config():
    return {"profile": get_profile(), "promotions": live_promotions()}


# ------------------------------------------------------------------ publishing
@transaction.atomic
def publish_home():
    """Re-validate everything that will be live, then publish all pending drafts together (all or nothing)."""
    drafts = list(HomeSection.objects.select_for_update().exclude(draft__isnull=True))
    for s in drafts:
        d = s.draft or {}
        enabled = d.get("is_enabled", s.is_enabled)
        if enabled or "content" in d:
            try:
                d["content"] = schemas.clean_content(s.section_type, d.get("content", s.content))
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"detail": f"“{s}” needs attention before it can go live.",
                                                   "section": str(s.public_id), "errors": exc.detail})
        s.draft = d
    for s in drafts:
        s.publish()
    return len(drafts)


@transaction.atomic
def discard_home():
    n = HomeSection.objects.exclude(draft__isnull=True).update(draft=None)
    return n


@transaction.atomic
def seed_sections(reset=False):
    """Create the default homepage. Only touches an empty homepage unless reset=True."""
    if HomeSection.objects.exists():
        if not reset:
            return 0
        HomeSection.objects.all().delete()
    for i, (t, label, enabled, content) in enumerate(DEFAULT_SECTIONS, start=1):
        HomeSection.objects.create(section_type=t, label=label, order=i * 10, is_enabled=enabled, content=content)
    return len(DEFAULT_SECTIONS)
