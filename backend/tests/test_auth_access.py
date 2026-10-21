import pytest

from apps.access.services import grant_enrollment, has_access
from apps.catalog.models import Lesson


def test_register_login_refresh_logout(client, db):
    r = client.post("/api/v1/auth/register", {"full_name": "A B", "email": "a@b.com", "password": "Str0ng-pass!"}, format="json")
    assert r.status_code == 201
    assert r.json()["user"]["status"] == "pending_payment"
    assert "refresh_token" in r.cookies and r.cookies["refresh_token"]["httponly"]

    r = client.post("/api/v1/auth/login", {"email": "a@b.com", "password": "Str0ng-pass!"}, format="json")
    assert r.status_code == 200 and "access" in r.json() and "refresh" not in r.json()

    r2 = client.post("/api/v1/auth/refresh")
    assert r2.status_code == 200 and "access" in r2.json()

    me = client.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {r2.json()['access']}")
    assert me.json()["email"] == "a@b.com"

    assert client.post("/api/v1/auth/logout").status_code == 204


def test_lesson_access_rules(user, course, plan):
    free = Lesson.objects.get(title="Free")
    paid = Lesson.objects.get(title="Paid")
    assert has_access(user, course, free)          # free preview
    assert not has_access(user, course, paid)      # not enrolled
    grant_enrollment(user, course, plan=plan)
    assert has_access(user, course, paid)


def test_curriculum_requires_enrollment(client, user, course, plan):
    client.force_authenticate(user)
    assert client.get("/api/v1/my/courses/python/curriculum").status_code == 403
    grant_enrollment(user, course, plan=plan)
    assert client.get("/api/v1/my/courses/python/curriculum").status_code == 200
