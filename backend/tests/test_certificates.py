import pytest

from apps.access.models import Enrollment
from apps.accounts.models import StudentProfile
from apps.assessments.models import Attempt, Test
from apps.catalog.models import Lesson
from apps.certificates import services
from apps.certificates.models import Certificate
from apps.learning.models import LessonProgress


@pytest.fixture
def enrolled(user, course):
    StudentProfile.objects.create(user=user, full_name="Asha Patil")
    Enrollment.objects.create(user=user, course=course)
    return user


def finish_lessons(user, course):
    for l in Lesson.objects.filter(module__course=course):
        LessonProgress.objects.update_or_create(user=user, lesson=l, defaults={"completed": True})


def test_locked_until_lessons_and_tests_done(enrolled, course, auth_client):
    test = Test.objects.create(course=course, title="Final")
    r = auth_client.get(f"/api/v1/my/courses/{course.slug}/certificate")
    assert r.status_code == 200 and not r.data["eligible"] and r.data["certificate"] is None
    assert auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate").status_code == 400

    finish_lessons(enrolled, course)
    assert not services.eligibility(enrolled, course)["eligible"]  # test still unpassed

    Attempt.objects.create(user=enrolled, test=test, expires_at="2030-01-01T00:00:00Z", score=8, total_marks=10,
                           passed=True, status="submitted")
    r = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate")
    assert r.status_code == 201 and r.data["recipient_name"] == "Asha Patil" and r.data["average_score"] == 80
    # claiming again is idempotent
    again = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate")
    assert again.data["code"] == r.data["code"] and Certificate.objects.count() == 1


def test_pdf_download_is_owner_only(enrolled, course, auth_client, admin_client):
    finish_lessons(enrolled, course)
    code = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate").data["code"]
    r = auth_client.get(f"/api/v1/certificates/{code}/download")
    assert r.status_code == 200 and r["Content-Type"] == "application/pdf" and r.content.startswith(b"%PDF")
    assert admin_client.get(f"/api/v1/certificates/{code}/download").status_code == 200
    from rest_framework.test import APIClient
    assert APIClient().get(f"/api/v1/certificates/{code}/download").status_code == 401


def test_public_verification(enrolled, course, auth_client, client):
    finish_lessons(enrolled, course)
    code = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate").data["code"]
    ok = client.get(f"/api/v1/certificates/verify/{code.lower()}")
    assert ok.data["valid"] and ok.data["recipient_name"] == "Asha Patil" and "email" not in ok.data
    assert client.get("/api/v1/certificates/verify/ITD-NOPE").status_code == 404
    Certificate.objects.update(revoked=True)
    assert client.get(f"/api/v1/certificates/verify/{code}").data["valid"] is False


def test_name_required(user, course, auth_client):
    Enrollment.objects.create(user=user, course=course)
    finish_lessons(user, course)
    r = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate")
    assert r.status_code == 400 and "full name" in r.data["detail"]


def test_admin_can_list_and_revoke(enrolled, course, auth_client, admin_client, client):
    finish_lessons(enrolled, course)
    cert = auth_client.post(f"/api/v1/my/courses/{course.slug}/certificate").data
    assert auth_client.get("/api/v1/admin-api/certificates").status_code == 403
    assert admin_client.get("/api/v1/admin-api/certificates?search=asha").data[0]["email"] == "stud@example.com"
    admin_client.post(f"/api/v1/admin-api/certificates/{cert['id']}/revoke", {"reason": "Cheating"}, format="json")
    assert auth_client.get("/api/v1/my/certificates").data == []
    assert client.get(f"/api/v1/certificates/verify/{cert['code']}").data["valid"] is False
