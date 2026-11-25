import io
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from apps.adminpanel.models import AuditLog
from apps.billing.models import Coupon
from apps.platform_config.models import SiteSetting
from apps.website.models import HomeSection, MediaAsset, PromoBanner

A = "/api/v1/admin-api/website"
PUBLIC = "/api/v1/site"


def png(size=(40, 30), fmt="PNG", name="pic.png", color=(20, 110, 245)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return SimpleUploadedFile(name, buf.getvalue(), content_type=f"image/{fmt.lower()}")


@pytest.fixture
def asset(admin_client):
    r = admin_client.post(f"{A}/media", {"image": png(), "alt_text": "Blue square"}, format="multipart")
    assert r.status_code == 201, r.data
    return r.data


def section(admin_client, stype):
    return next(s for s in admin_client.get(f"{A}/sections").data if s["section_type"] == stype)


def promo_body(**kw):
    now = timezone.now()
    body = {"name": "Year-end sale", "title": "Year-end sale: 15% off", "description": "All plans", "badge_text": "Limited",
            "cta_label": "View plans", "cta_url": "/pricing", "placements": ["top_bar", "home_section"], "theme": "brand",
            "starts_at": (now - timedelta(hours=1)).isoformat(), "ends_at": (now + timedelta(days=5)).isoformat(), "is_active": True}
    body.update(kw)
    return body


# ================================================================ access control
def test_admin_endpoints_reject_students_and_anonymous(auth_client, client, db):
    for path in ("/schema", "/sections", "/promotions", "/media", "/profile", "/home/status", "/home/preview"):
        assert auth_client.get(A + path).status_code == 403, path
        assert client.get(A + path).status_code == 401, path
    for path in ("/home/publish", "/home/discard"):
        assert auth_client.post(A + path).status_code == 403
        assert client.post(A + path).status_code == 401


def test_public_endpoints_need_no_login(client, db):
    assert client.get(f"{PUBLIC}/config").status_code == 200
    assert client.get(f"{PUBLIC}/home").status_code == 200


# ================================================================ homepage content
def test_fresh_install_has_a_working_default_homepage(client, db):
    types = [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]]
    assert types[0] == "hero" and "plans" in types and "faq" in types and "cta" in types
    assert "testimonials" not in types, "disabled and empty by default; no fake testimonials"
    assert "promo" not in types, "no promotion is live, so the promo section must not leave a gap"


def test_no_festival_or_campaign_content_ships_in_defaults(client, db):
    import json
    blob = json.dumps([client.get(f"{PUBLIC}/home").data, client.get(f"{PUBLIC}/config").data]).lower()
    for word in ("diwali", "welcome10", "navratri", "christmas", "% off"):
        assert word not in blob


def test_edits_stay_draft_until_published(admin_client, client):
    hero = section(admin_client, "hero")
    content = {**hero["content"], "heading": "A brand new heading"}
    r = admin_client.patch(f"{A}/sections/{hero['id']}", {"content": content}, format="json")
    assert r.status_code == 200 and r.data["has_draft"] and r.data["content"]["heading"] == "A brand new heading"

    public = lambda: next(s for s in client.get(f"{PUBLIC}/home").data["sections"] if s["type"] == "hero")["content"]["heading"]  # noqa: E731
    assert public() == "Start learning IT skills in minutes", "visitors must not see unpublished changes"
    prev = admin_client.get(f"{A}/home/preview").data["sections"]
    assert next(s for s in prev if s["type"] == "hero")["content"]["heading"] == "A brand new heading"
    assert admin_client.get(f"{A}/home/status").data["pending"] == 1

    assert admin_client.post(f"{A}/home/publish").data["published"] == 1
    assert public() == "A brand new heading"
    assert admin_client.get(f"{A}/home/status").data["pending"] == 0


def test_discard_throws_away_drafts(admin_client, client):
    hero = section(admin_client, "hero")
    admin_client.patch(f"{A}/sections/{hero['id']}", {"is_enabled": False, "content": {**hero["content"], "heading": "Oops"}}, format="json")
    assert admin_client.post(f"{A}/home/discard").data["discarded"] == 1
    again = section(admin_client, "hero")
    assert again["is_enabled"] and again["content"]["heading"] != "Oops" and not again["has_draft"]


def test_disable_and_reorder_apply_on_publish(admin_client, client):
    secs = admin_client.get(f"{A}/sections").data
    ids = [s["id"] for s in secs]
    cta = section(admin_client, "cta")
    admin_client.patch(f"{A}/sections/{cta['id']}", {"is_enabled": False}, format="json")
    faq = section(admin_client, "faq")
    new_order = [faq["id"]] + [i for i in ids if i != faq["id"]]
    assert admin_client.post(f"{A}/sections/reorder", {"ids": new_order}, format="json").status_code == 200

    before = [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]]
    assert before[0] == "hero" and "cta" in before
    admin_client.post(f"{A}/home/publish")
    after = [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]]
    assert after[0] == "faq" and "cta" not in after


def test_reorder_requires_every_section(admin_client):
    ids = [s["id"] for s in admin_client.get(f"{A}/sections").data]
    assert admin_client.post(f"{A}/sections/reorder", {"ids": ids[:-1]}, format="json").status_code == 400


def test_section_validation_messages(admin_client):
    hero = section(admin_client, "hero")
    url = f"{A}/sections/{hero['id']}"
    bad = lambda **kw: admin_client.patch(url, {"content": {**hero["content"], **kw}}, format="json")  # noqa: E731

    r = bad(heading="")
    assert r.status_code == 400 and "required" in r.data["heading"][0].lower()
    r = bad(primary_cta_url="javascript:alert(1)")
    assert r.status_code == 400 and "primary_cta_url" in r.data
    r = bad(primary_cta_url="//evil.example/x")
    assert r.status_code == 400
    r = bad(heading="x" * 500)
    assert r.status_code == 400 and "under 120" in r.data["heading"][0]
    r = bad(image="11111111-1111-1111-1111-111111111111")
    assert r.status_code == 400 and "image" in r.data
    for ok in ("/pricing", "https://example.com/a", "#chat", "mailto:a@b.co", "tel:+91 98765 43210"):
        assert bad(primary_cta_url=ok).status_code == 200, ok


def test_nested_list_errors_point_at_the_item(admin_client):
    s = section(admin_client, "highlights")
    items = [{"icon": "code", "title": "Fine", "text": ""}, {"icon": "nope", "title": "", "text": ""}]
    r = admin_client.patch(f"{A}/sections/{s['id']}", {"content": {**s["content"], "items": items}}, format="json")
    assert r.status_code == 400
    errs = r.data["items"]
    assert errs[0] == {} and "icon" in errs[1] and "title" in errs[1]


def test_unknown_keys_are_dropped_and_text_is_cleaned(admin_client):
    hero = section(admin_client, "hero")
    r = admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero["content"], "heading": "  Hello\x00   world  ", "script": "<b>"}}, format="json")
    assert r.data["content"]["heading"] == "Hello world" and "script" not in r.data["content"]


def test_singleton_sections_cannot_be_duplicated_but_others_can(admin_client):
    assert admin_client.post(f"{A}/sections", {"section_type": "hero"}, format="json").status_code == 400
    r = admin_client.post(f"{A}/sections", {"section_type": "highlights"}, format="json")
    assert r.status_code == 201 and r.data["is_enabled"] and r.data["has_draft"]
    assert admin_client.post(f"{A}/sections", {"section_type": "nonsense"}, format="json").status_code == 400


def test_new_section_is_invisible_until_filled_in_and_published(admin_client, client):
    r = admin_client.post(f"{A}/sections", {"section_type": "cta"}, format="json")
    # default content has empty required fields, so publishing must refuse and name the section
    p = admin_client.post(f"{A}/home/publish")
    assert p.status_code == 400 and "needs attention" in str(p.data["detail"])
    assert HomeSection.objects.get(public_id=r.data["id"]).draft is not None
    content = {"heading": "Join us", "text": "", "cta_label": "Sign up", "cta_url": "/register", "show_offer_code": False}
    assert admin_client.patch(f"{A}/sections/{r.data['id']}", {"content": content}, format="json").status_code == 200
    assert admin_client.post(f"{A}/home/publish").status_code == 200
    assert [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]].count("cta") == 2


def test_failed_publish_is_all_or_nothing(admin_client, client):
    hero = section(admin_client, "hero")
    admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero['content'], "heading": "Should not go live"}}, format="json")
    admin_client.post(f"{A}/sections", {"section_type": "cta"}, format="json")  # invalid until filled in
    assert admin_client.post(f"{A}/home/publish").status_code == 400
    h = next(s for s in client.get(f"{PUBLIC}/home").data["sections"] if s["type"] == "hero")
    assert h["content"]["heading"] != "Should not go live"


def test_empty_sections_do_not_render(admin_client, client):
    t = section(admin_client, "testimonials")
    admin_client.patch(f"{A}/sections/{t['id']}", {"is_enabled": True}, format="json")
    admin_client.post(f"{A}/home/publish")
    assert "testimonials" not in [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]], "enabled but empty stays hidden"
    items = [{"name": "Asha", "role": "Python learner", "text": "Clear lessons.", "rating": 5, "photo": ""}]
    admin_client.patch(f"{A}/sections/{t['id']}", {"content": {**t["content"], "items": items}}, format="json")
    admin_client.post(f"{A}/home/publish")
    assert "testimonials" in [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]]


def test_section_delete_is_audited(admin_client):
    s = admin_client.post(f"{A}/sections", {"section_type": "stats"}, format="json").data
    assert admin_client.delete(f"{A}/sections/{s['id']}").status_code == 204
    assert AuditLog.objects.filter(target_type="Homepage section", action="deleted").exists()


def test_schema_endpoint_describes_every_section_type(admin_client):
    d = admin_client.get(f"{A}/schema").data
    assert {"hero", "promo", "stats", "highlights", "showcase", "courses", "plans", "support", "testimonials", "faq", "cta"} <= set(d["sections"])
    assert [p["value"] for p in d["placements"]] == ["top_bar", "home_section", "pricing"]
    assert any(f["name"] == "image" and f["type"] == "image" for f in d["sections"]["hero"]["fields"])


# ================================================================ promotions
def test_no_promotion_means_nothing_to_show(client, db):
    assert client.get(f"{PUBLIC}/config").data["promotions"] == []


def test_create_promotion_and_it_appears_on_the_site(admin_client, client):
    r = admin_client.post(f"{A}/promotions", promo_body(), format="json")
    assert r.status_code == 201 and r.data["status"] == "live"
    promos = client.get(f"{PUBLIC}/config").data["promotions"]
    assert len(promos) == 1 and promos[0]["title"] == "Year-end sale: 15% off"
    assert "name" not in promos[0] and "is_active" not in promos[0], "internal fields never reach visitors"
    home = client.get(f"{PUBLIC}/home").data["sections"]
    assert [s for s in home if s["type"] == "promo"][0]["promotion"]["id"] == promos[0]["id"]


def test_schedule_controls_visibility(admin_client, client):
    now = timezone.now()
    future = admin_client.post(f"{A}/promotions", promo_body(name="Soon", starts_at=(now + timedelta(days=1)).isoformat(), ends_at=(now + timedelta(days=3)).isoformat()), format="json")
    assert future.data["status"] == "scheduled"
    assert client.get(f"{PUBLIC}/config").data["promotions"] == []
    # an ended campaign (created directly: the API refuses to activate one that already ended)
    PromoBanner.objects.create(name="Old", title="Old", placements=["top_bar"], is_active=True, ends_at=now - timedelta(minutes=1))
    assert client.get(f"{PUBLIC}/config").data["promotions"] == []
    admin_client.patch(f"{A}/promotions/{future.data['id']}", {"starts_at": (now - timedelta(minutes=1)).isoformat()}, format="json")
    assert len(client.get(f"{PUBLIC}/config").data["promotions"]) == 1


def test_deactivating_hides_the_promotion_and_the_home_section(admin_client, client):
    p = admin_client.post(f"{A}/promotions", promo_body(), format="json").data
    admin_client.patch(f"{A}/promotions/{p['id']}", {"is_active": False}, format="json")
    assert client.get(f"{PUBLIC}/config").data["promotions"] == []
    assert "promo" not in [s["type"] for s in client.get(f"{PUBLIC}/home").data["sections"]]


def test_placement_filter_and_priority(admin_client, client):
    admin_client.post(f"{A}/promotions", promo_body(name="Low", title="Low", placements=["pricing"], priority=1), format="json")
    admin_client.post(f"{A}/promotions", promo_body(name="High", title="High", placements=["pricing", "top_bar"], priority=9), format="json")
    titles = [p["title"] for p in client.get(f"{PUBLIC}/config").data["promotions"]]
    assert titles == ["High", "Low"]
    assert [s for s in client.get(f"{PUBLIC}/home").data["sections"] if s["type"] == "promo"] == [], "neither targets the homepage section"


def test_promotion_validation(admin_client):
    now = timezone.now()
    post = lambda **kw: admin_client.post(f"{A}/promotions", promo_body(**kw), format="json")  # noqa: E731
    r = post(starts_at=(now + timedelta(days=2)).isoformat(), ends_at=(now + timedelta(days=1)).isoformat())
    assert r.status_code == 400 and "after the start" in r.data["ends_at"][0]
    assert "already passed" in post(ends_at=(now - timedelta(days=1)).isoformat(), starts_at=None).data["ends_at"][0]
    assert "countdown" in post(show_countdown=True, ends_at=None).data["show_countdown"][0].lower()
    assert "placements" in post(placements=[]).data
    assert "placements" in post(placements=["footer"]).data
    assert "cta_url" in post(cta_url="javascript:alert(1)").data
    assert "cta_url" in post(cta_url="").data, "button text without a link"
    assert "title" in post(title="   ").data
    assert post(is_active=False, ends_at=(now - timedelta(days=1)).isoformat(), starts_at=None).status_code == 201, "a past date is fine for an inactive draft"


def test_linked_coupon_drives_display_and_visibility(admin_client, client):
    c = Coupon.objects.create(code="SPRING15", percent_off=Decimal("15"))
    p = admin_client.post(f"{A}/promotions", promo_body(coupon=str(c.public_id)), format="json").data
    assert p["coupon_code"] == "SPRING15" and p["coupon_percent"] == 15.0
    pub = client.get(f"{PUBLIC}/config").data["promotions"][0]
    assert pub["coupon"] == {"code": "SPRING15", "percent_off": 15.0, "flat_off": 0.0}

    c.is_active = False
    c.save()
    assert client.get(f"{PUBLIC}/config").data["promotions"] == [], "never advertise a code that no longer works"
    got = admin_client.get(f"{A}/promotions/{p['id']}").data
    assert got["status"] == "coupon_invalid" and any("coupon" in w.lower() for w in got["warnings"])


def test_countdown_only_exposed_when_enabled(admin_client, client):
    admin_client.post(f"{A}/promotions", promo_body(show_countdown=False), format="json")
    assert client.get(f"{PUBLIC}/config").data["promotions"][0]["ends_at"] is None
    PromoBanner.objects.update(show_countdown=True)
    assert client.get(f"{PUBLIC}/config").data["promotions"][0]["ends_at"]


def test_duplicate_creates_an_inactive_copy(admin_client):
    p = admin_client.post(f"{A}/promotions", promo_body(show_countdown=True), format="json").data
    d = admin_client.post(f"{A}/promotions/{p['id']}/duplicate").data
    assert d["id"] != p["id"] and d["name"].endswith("(copy)") and not d["is_active"] and d["status"] == "draft"
    assert d["starts_at"] is None and d["ends_at"] is None and not d["show_countdown"]


def test_promotion_list_filters_by_status(admin_client):
    admin_client.post(f"{A}/promotions", promo_body(name="Live one"), format="json")
    admin_client.post(f"{A}/promotions", promo_body(name="Paused", is_active=False), format="json")
    assert [p["name"] for p in admin_client.get(f"{A}/promotions?status=live").data] == ["Live one"]
    assert [p["name"] for p in admin_client.get(f"{A}/promotions?status=draft").data] == ["Paused"]
    assert len(admin_client.get(f"{A}/promotions?search=paus").data) == 1


def test_promotion_changes_are_audited_and_deletable(admin_client):
    p = admin_client.post(f"{A}/promotions", promo_body(), format="json").data
    admin_client.patch(f"{A}/promotions/{p['id']}", {"title": "Changed"}, format="json")
    assert admin_client.delete(f"{A}/promotions/{p['id']}").status_code == 204
    assert set(AuditLog.objects.filter(target_type="Promotion").values_list("action", flat=True)) == {"created", "updated", "deleted"}


def test_promotion_images_resolve_for_visitors(admin_client, client, asset):
    admin_client.post(f"{A}/promotions", promo_body(desktop_image=asset["id"], mobile_image=asset["id"]), format="json")
    pub = client.get(f"{PUBLIC}/config").data["promotions"][0]
    assert pub["desktop_image"]["url"].startswith("/media/site/") and pub["mobile_image"]["alt"] == "Blue square"


# ================================================================ media
def test_upload_is_stored_and_listed(admin_client, asset):
    assert asset["url"].startswith("/media/site/") and asset["width"] == 40 and asset["alt_text"] == "Blue square"
    rows = admin_client.get(f"{A}/media").data["results"]
    assert len(rows) == 1 and rows[0]["in_use"] == 0


def test_upload_rejects_non_images_svg_and_oversize(admin_client, settings):
    post = lambda f: admin_client.post(f"{A}/media", {"image": f}, format="multipart")  # noqa: E731
    r = post(SimpleUploadedFile("note.png", b"this is not an image", content_type="image/png"))
    assert r.status_code == 400 and "not a valid image" in r.data["image"][0]
    svg = SimpleUploadedFile("x.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', content_type="image/svg+xml")
    assert post(svg).status_code == 400
    settings.WEBSITE_MAX_IMAGE_MB = 0
    assert "up to 0 MB" in post(png()).data["image"][0]
    assert MediaAsset.objects.count() == 0


def test_large_images_are_downscaled_and_rewritten(admin_client):
    r = admin_client.post(f"{A}/media", {"image": png(size=(3200, 1600), fmt="JPEG", name="huge.jpg")}, format="multipart")
    assert r.status_code == 201 and r.data["width"] == 2400 and r.data["height"] == 1200 and r.data["name"].endswith(".jpg")


def test_original_filename_is_not_used_on_disk(admin_client):
    r = admin_client.post(f"{A}/media", {"image": png(name="../../etc/passwd.png")}, format="multipart")
    assert r.status_code == 201 and "passwd" not in r.data["url"] and ".." not in r.data["url"]


def test_image_in_use_cannot_be_deleted(admin_client, asset):
    hero = section(admin_client, "hero")
    admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero["content"], "image": asset["id"]}}, format="json")
    r = admin_client.delete(f"{A}/media/{asset['id']}")
    assert r.status_code == 409 and r.data["usage"][0]["type"] == "section"
    assert admin_client.get(f"{A}/media").data["results"][0]["in_use"] >= 1

    admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero["content"], "image": ""}}, format="json")
    admin_client.post(f"{A}/home/publish")
    assert admin_client.delete(f"{A}/media/{asset['id']}").status_code == 204


def test_image_used_by_promotion_blocks_delete(admin_client, asset):
    admin_client.post(f"{A}/promotions", promo_body(desktop_image=asset["id"]), format="json")
    assert admin_client.delete(f"{A}/media/{asset['id']}").status_code == 409


def test_section_image_resolves_to_url_for_visitors(admin_client, client, asset):
    hero = section(admin_client, "hero")
    admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero["content"], "image": asset["id"]}}, format="json")
    pre = lambda: next(s for s in client.get(f"{PUBLIC}/home").data["sections"] if s["type"] == "hero")["content"]["image"]  # noqa: E731
    assert pre() in ("", None), "draft image must not leak"
    admin_client.post(f"{A}/home/publish")
    assert pre()["url"].startswith("/media/site/") and pre()["alt"] == "Blue square"


def test_deleted_image_never_breaks_the_page(admin_client, client, asset):
    hero = section(admin_client, "hero")
    admin_client.patch(f"{A}/sections/{hero['id']}", {"content": {**hero["content"], "image": asset["id"]}}, format="json")
    admin_client.post(f"{A}/home/publish")
    MediaAsset.objects.all().delete()  # bypasses the API guard, e.g. someone using the Django admin
    r = client.get(f"{PUBLIC}/home")
    assert r.status_code == 200 and next(s for s in r.data["sections"] if s["type"] == "hero")["content"]["image"] is None


def test_alt_text_can_be_edited(admin_client, asset):
    r = admin_client.patch(f"{A}/media/{asset['id']}", {"alt_text": "  Logo   mark "}, format="json")
    assert r.status_code == 200 and r.data["alt_text"] == "Logo mark"


# ================================================================ profile
def test_profile_defaults_and_update(admin_client, client):
    assert client.get(f"{PUBLIC}/config").data["profile"]["brand_name"] == "IT DigiTech"
    vals = admin_client.get(f"{A}/profile").data["values"]
    r = admin_client.put(f"{A}/profile", {**vals, "email": "hello@itdigitech.in", "phone": "+91 98765 43210", "seo_title": "Learn IT"}, format="json")
    assert r.status_code == 200
    pub = client.get(f"{PUBLIC}/config").data["profile"]
    assert pub["email"] == "hello@itdigitech.in" and pub["seo_title"] == "Learn IT"
    assert client.get(f"{PUBLIC}/home").data["seo"]["title"] == "Learn IT"


def test_profile_validation(admin_client):
    vals = admin_client.get(f"{A}/profile").data["values"]
    r = admin_client.put(f"{A}/profile", {**vals, "brand_name": "", "terms_url": "javascript:x", "seo_description": "x" * 400}, format="json")
    assert r.status_code == 400 and {"brand_name", "terms_url", "seo_description"} <= set(r.data)


def test_corrupt_profile_json_cannot_break_the_public_site(client, db):
    SiteSetting.objects.create(key="website-profile", value={"brand_name": ["not", "text"], "terms_url": "javascript:x"})
    r = client.get(f"{PUBLIC}/config")
    assert r.status_code == 200 and r.data["profile"]["brand_name"] == "IT DigiTech"


# ================================================================ management command
def test_seed_command_is_idempotent(db):
    from django.core.management import call_command
    n = HomeSection.objects.count()
    call_command("seed_website")
    assert HomeSection.objects.count() == n
    HomeSection.objects.filter(section_type="cta").update(content={"heading": "edited"})
    call_command("seed_website", "--reset")
    assert HomeSection.objects.count() == n and HomeSection.objects.get(section_type="cta").content["heading"] != "edited"
