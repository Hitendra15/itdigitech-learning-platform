"""
Declarative description of every editable piece of the public website.

One definition drives three things, so they can never drift apart:
  * server-side validation of whatever the admin saves (`clean_content`),
  * the admin forms (served to the console by `GET /admin-api/website/schema`),
  * resolving image references into URLs for the public site (`resolve_content`).

Adding a new homepage section type = adding one entry to SECTION_TYPES (plus a renderer in the frontend).
"""
import copy
import re

from rest_framework import serializers

# --------------------------------------------------------------------------- field builders
def _f(type_, name, label, **kw):
    return {"type": type_, "name": name, "label": label, "required": False, "help": "", **kw}


def Text(name, label, max=160, **kw):
    return _f("text", name, label, max=max, **kw)


def Textarea(name, label, max=600, **kw):
    return _f("textarea", name, label, max=max, **kw)


def Url(name, label, **kw):
    return _f("url", name, label, max=300, **kw)


def Image(name, label, **kw):
    return _f("image", name, label, **kw)


def Bool(name, label, **kw):
    return _f("bool", name, label, **kw)


def Number(name, label, min=0, max=100, **kw):
    return _f("number", name, label, min=min, max=max, **kw)


def Select(name, label, options, **kw):
    return _f("select", name, label, options=[{"value": v, "label": l} for v, l in options], **kw)


def ListOf(name, label, fields, max_items=12, item_label="Item", **kw):
    return _f("list", name, label, fields=fields, max_items=max_items, item_label=item_label, **kw)


# Icons the public site can render. Keys map to components in frontend/src/site/icons.js.
ICONS = [
    ("code", "Code"), ("headset", "Support"), ("award", "Certificate"), ("test", "Test"), ("dashboard", "Dashboard"),
    ("receipt", "Invoice"), ("shield", "Shield"), ("play", "Video"), ("chat", "Chat"), ("book", "Book"),
    ("clock", "Clock"), ("star", "Star"), ("check", "Check"), ("users", "People"), ("chart", "Chart"),
    ("zap", "Fast"), ("terminal", "Terminal"), ("briefcase", "Career"), ("card", "Payment"), ("lock", "Security"),
]
ICON_KEYS = {k for k, _ in ICONS}

PLACEMENTS = [
    ("top_bar", "Announcement bar (top of every public page)"),
    ("home_section", "Homepage promo section"),
    ("pricing", "Pricing page"),
]
THEMES = [("brand", "Brand blue"), ("dark", "Dark"), ("light", "Light"), ("accent", "Warm accent")]

_ICON = lambda **kw: Select("icon", "Icon", ICONS, default="check", **kw)  # noqa: E731

# --------------------------------------------------------------------------- homepage sections
SECTION_TYPES = {
    "hero": {
        "label": "Hero",
        "description": "The first thing visitors see: headline, short description and the main buttons.",
        "singleton": True,
        "fields": [
            Text("eyebrow", "Small label above the heading", max=80),
            Text("heading", "Heading", max=120, required=True),
            Textarea("subheading", "Description", max=300),
            ListOf("bullets", "Key points", [Text("text", "Point", max=120, required=True)], max_items=5, item_label="Point"),
            Text("primary_cta_label", "Main button text", max=40),
            Url("primary_cta_url", "Main button link"),
            Text("secondary_cta_label", "Second button text", max=40),
            Url("secondary_cta_url", "Second button link"),
            Bool("show_starting_price", "Show “starting at” price from the live plans", default=True),
            Text("assurance", "Reassurance line under the buttons", max=120),
            Image("image", "Hero image", help="Optional. Wide screenshots or illustrations work best (about 1200×900)."),
        ],
    },
    "promo": {
        "label": "Promotion",
        "description": "Shows the currently active promotion for the “Homepage promo section” placement. "
                       "Disappears on its own when no promotion is live.",
        "singleton": True,
        "fields": [],
    },
    "stats": {
        "label": "Statistics",
        "description": "A short row of facts. Use real numbers only; the section hides itself when empty.",
        "singleton": False,
        "fields": [
            ListOf("items", "Statistics", [Text("value", "Value", max=20, required=True), Text("label", "Label", max=80, required=True)],
                   max_items=6, item_label="Statistic"),
        ],
    },
    "highlights": {
        "label": "Feature cards",
        "description": "A grid of benefit cards, each with an icon, title and short text.",
        "singleton": False,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            ListOf("items", "Cards", [_ICON(), Text("title", "Title", max=80, required=True), Textarea("text", "Text", max=240)],
                   max_items=9, item_label="Card"),
        ],
    },
    "showcase": {
        "label": "Product modules",
        "description": "Alternating rows that explain one product area each, with an optional image and link.",
        "singleton": False,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            ListOf("items", "Modules", [
                Text("tag", "Small label", max=30),
                Text("title", "Title", max=100, required=True),
                Textarea("text", "Text", max=320),
                Text("cta_label", "Link text", max=40),
                Url("cta_url", "Link"),
                Image("image", "Image"),
            ], max_items=8, item_label="Module"),
        ],
    },
    "courses": {
        "label": "Courses",
        "description": "Your published courses, loaded live. Hidden automatically if there are none.",
        "singleton": True,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            Number("limit", "How many courses to show", min=3, max=12, default=6),
            Text("cta_label", "Button text", max=40),
            Url("cta_url", "Button link"),
        ],
    },
    "plans": {
        "label": "Plans and pricing",
        "description": "Your active plans, loaded live from billing. Prices always come from the Plans screen.",
        "singleton": True,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            Bool("show_included", "Show the “included in every plan” list", default=True),
            ListOf("included", "Included in every plan", [Text("text", "Benefit", max=80, required=True)], max_items=16, item_label="Benefit"),
            Bool("show_compare", "Show the plan comparison table", default=True),
        ],
    },
    "support": {
        "label": "Support",
        "description": "Explain how learners get help. The button opens live chat.",
        "singleton": False,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            ListOf("items", "Support points", [_ICON(), Text("title", "Title", max=80, required=True), Textarea("text", "Text", max=240)],
                   max_items=6, item_label="Point"),
            Text("cta_label", "Button text", max=40),
        ],
    },
    "testimonials": {
        "label": "Testimonials",
        "description": "Real learner feedback only. The section hides itself until you add at least one.",
        "singleton": False,
        "fields": [
            Text("heading", "Heading", max=120),
            Textarea("lead", "Intro text", max=300),
            ListOf("items", "Testimonials", [
                Text("name", "Name", max=80, required=True),
                Text("role", "Role or course", max=100),
                Textarea("text", "What they said", max=400, required=True),
                Number("rating", "Rating (1 to 5)", min=1, max=5, default=5),
                Image("photo", "Photo"),
            ], max_items=9, item_label="Testimonial"),
        ],
    },
    "faq": {
        "label": "FAQs",
        "description": "Questions come from Console → Help articles, so there is one place to maintain them.",
        "singleton": True,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("lead", "Intro text", max=300),
            Number("limit", "How many questions to show", min=3, max=20, default=8),
        ],
    },
    "cta": {
        "label": "Closing call to action",
        "description": "A final prompt at the bottom of the page.",
        "singleton": False,
        "fields": [
            Text("heading", "Heading", max=120, required=True),
            Textarea("text", "Text", max=300),
            Text("cta_label", "Button text", max=40, required=True),
            Url("cta_url", "Button link", required=True),
            Text("secondary_cta_label", "Second button text", max=40),
            Url("secondary_cta_url", "Second button link"),
            Bool("show_offer_code", "Mention the live promotion’s coupon code", default=True),
        ],
    },
}

# --------------------------------------------------------------------------- company profile + SEO
PROFILE_FIELDS = [
    Text("brand_name", "Company name", max=80, required=True, default="IT DigiTech"),
    Text("product_name", "Product name", max=80, default="IT DigiTech Learn"),
    Text("tagline", "Tagline", max=120, default="Learn. Practice. Get certified."),
    Textarea("about", "Footer description", max=400),
    Text("email", "Support email", max=120),
    Text("phone", "Phone", max=40),
    Text("hours", "Support hours", max=80),
    Text("address", "Address", max=200),
    Text("legal_name", "Registered company name", max=120),
    Text("registration", "Company registration number", max=60),
    Text("gstin", "GSTIN", max=20),
    Url("terms_url", "Terms of service link"),
    Url("privacy_url", "Privacy policy link"),
    ListOf("payment_methods", "Payment methods shown in the footer", [Text("text", "Method", max=30, required=True)], max_items=10, item_label="Method"),
    Text("footer_note", "Footer note", max=120),
    Text("seo_title", "Homepage title (SEO)", max=70, help="Shown in browser tabs and search results. Aim for under 60 characters."),
    Textarea("seo_description", "Homepage description (SEO)", max=170, help="Shown under the title in search results. Aim for under 160 characters."),
    Image("og_image", "Social sharing image", help="Used when the site is shared on social networks (1200×630 works best)."),
]


# --------------------------------------------------------------------------- validation
_CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_URL_OK = re.compile(r"^(https?://[^\s]+|/(?!/)[^\s]*|#[A-Za-z0-9_\-/]*|mailto:[^\s]+|tel:[+0-9\-\s()]+)$")


def clean_url(value):
    """Relative paths, in-page anchors, mailto/tel and http(s) links. Never javascript: or data:."""
    value = value.strip()
    if value and not _URL_OK.match(value):
        raise ValueError("Use a full link starting with https://, or a path like /pricing.")
    return value


def _clean_field(spec, value):
    t = spec["type"]
    empty = value in (None, "", [])
    if empty and t not in ("bool", "list"):
        if spec["required"]:
            raise ValueError("This field is required.")
        return spec.get("default", "") if t != "number" else spec.get("default")
    if t in ("text", "textarea", "url"):
        if not isinstance(value, str):
            raise ValueError("Enter text.")
        value = _CTRL.sub("", value).strip()
        if t == "text":
            value = " ".join(value.split())
        if spec["required"] and not value:
            raise ValueError("This field is required.")
        if len(value) > spec["max"]:
            raise ValueError(f"Keep this under {spec['max']} characters (now {len(value)}).")
        return clean_url(value) if t == "url" else value
    if t == "bool":
        if isinstance(value, bool):
            return value
        if value in (None, ""):
            return bool(spec.get("default", False))
        return str(value).lower() in ("1", "true", "yes")
    if t == "number":
        try:
            n = int(value)
        except (TypeError, ValueError):
            raise ValueError("Enter a whole number.")
        if not spec["min"] <= n <= spec["max"]:
            raise ValueError(f"Enter a number between {spec['min']} and {spec['max']}.")
        return n
    if t == "select":
        if value not in {o["value"] for o in spec["options"]}:
            raise ValueError("Choose one of the listed options.")
        return value
    if t == "image":
        value = str(value).strip().lower()
        if not _UUID.match(value):
            raise ValueError("Choose an image from the media library.")
        from .models import MediaAsset  # local import: models import this module's constants

        if not MediaAsset.objects.filter(public_id=value).exists():
            raise ValueError("That image no longer exists. Choose another one.")
        return value
    if t == "list":
        if value in (None, ""):
            value = []
        if not isinstance(value, list):
            raise ValueError("Expected a list.")
        if len(value) > spec["max_items"]:
            raise ValueError(f"Add at most {spec['max_items']} items.")
        cleaned, errors = [], []
        for item in value:
            c, e = _clean_fields(spec["fields"], item if isinstance(item, dict) else {})
            cleaned.append(c)
            errors.append(e)
        if any(errors):
            raise _ListError(errors)
        return cleaned
    raise ValueError("Unsupported field.")  # pragma: no cover


class _ListError(Exception):
    def __init__(self, errors):
        self.errors = errors


def _clean_fields(fields, data):
    out, errors = {}, {}
    for spec in fields:
        try:
            out[spec["name"]] = _clean_field(spec, data.get(spec["name"]))
        except _ListError as exc:
            errors[spec["name"]] = exc.errors
        except ValueError as exc:
            errors[spec["name"]] = str(exc)
    return out, errors


def clean_fields(fields, data):
    """Validate `data` against a field list. Unknown keys are dropped. Raises DRF ValidationError."""
    if not isinstance(data, dict):
        raise serializers.ValidationError("Expected an object.")
    cleaned, errors = _clean_fields(fields, data)
    if errors:
        raise serializers.ValidationError(errors)
    return cleaned


def clean_content(section_type, data):
    return clean_fields(SECTION_TYPES[section_type]["fields"], data)


def default_content(section_type):
    return copy.deepcopy({f["name"]: f.get("default", [] if f["type"] == "list" else "" if f["type"] != "bool" else False)
                          for f in SECTION_TYPES[section_type]["fields"]})


# --------------------------------------------------------------------------- image resolution for the public site
def _collect_ids(fields, data, found):
    for spec in fields:
        v = data.get(spec["name"])
        if spec["type"] == "image" and isinstance(v, str) and v:
            found.add(v)
        elif spec["type"] == "list" and isinstance(v, list):
            for item in v:
                if isinstance(item, dict):
                    _collect_ids(spec["fields"], item, found)


def _swap(fields, data, assets):
    out = dict(data)
    for spec in fields:
        v = data.get(spec["name"])
        if spec["type"] == "image":
            out[spec["name"]] = assets.get(v) if v else None
        elif spec["type"] == "list" and isinstance(v, list):
            out[spec["name"]] = [_swap(spec["fields"], i, assets) for i in v if isinstance(i, dict)]
    return out


def asset_payload(asset):
    return {"url": asset.image.url, "alt": asset.alt_text, "width": asset.width, "height": asset.height}


def resolve_many(items):
    """items: [(fields, data)] -> list of data with image ids replaced by {url, alt, width, height} (or None), one query."""
    from .models import MediaAsset

    ids = set()
    for fields, data in items:
        _collect_ids(fields, data, ids)
    assets = {str(a.public_id): asset_payload(a) for a in MediaAsset.objects.filter(public_id__in=ids)} if ids else {}
    return [_swap(fields, data, assets) for fields, data in items], assets


def referenced_asset_ids(fields, data):
    found = set()
    _collect_ids(fields, data or {}, found)
    return found


def public_schema():
    """Everything the admin console needs to render forms."""
    return {
        "sections": {k: {kk: vv for kk, vv in v.items()} for k, v in SECTION_TYPES.items()},
        "profile": PROFILE_FIELDS,
        "placements": [{"value": v, "label": l} for v, l in PLACEMENTS],
        "themes": [{"value": v, "label": l} for v, l in THEMES],
        "icons": [{"value": v, "label": l} for v, l in ICONS],
    }
