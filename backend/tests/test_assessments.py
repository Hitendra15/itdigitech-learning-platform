from datetime import timedelta

from django.utils import timezone

from apps.access.services import grant_enrollment
from apps.assessments import services
from apps.assessments.models import Attempt, Question, Test
from apps.assessments.tasks import auto_submit_expired_attempts


def _make_test(course):
    t = Test.objects.create(course=course, title="T", duration_minutes=5, pass_percent=50, max_attempts=1)
    q1 = Question.objects.create(test=t, text="q1", options=[{"id": "a", "text": "x"}], correct_answer=["a"])
    q2 = Question.objects.create(test=t, text="q2", options=[{"id": "a", "text": "x"}], correct_answer=["a", "b"])
    return t, q1, q2


def test_attempt_flow_and_scoring(client, user, course, plan):
    grant_enrollment(user, course, plan=plan)
    t, q1, q2 = _make_test(course)
    client.force_authenticate(user)
    start = client.post(f"/api/v1/tests/{t.public_id}/start").json()
    assert "correct_answer" not in start["questions"][0]
    aid = start["attempt"]["id"]
    client.post(f"/api/v1/attempts/{aid}/answer", {"question_id": str(q1.public_id), "response": ["a"]}, format="json")
    client.post(f"/api/v1/attempts/{aid}/answer", {"question_id": str(q2.public_id), "response": ["a"]}, format="json")
    res = client.post(f"/api/v1/attempts/{aid}/submit").json()
    assert res["score"] == 1 and res["total_marks"] == 2 and res["passed"] is True
    # attempts are limited
    assert client.post(f"/api/v1/tests/{t.public_id}/start").status_code == 400


def test_expired_attempt_is_auto_submitted(user, course, plan):
    grant_enrollment(user, course, plan=plan)
    t, *_ = _make_test(course)
    attempt = services.start_attempt(user, t)
    Attempt.objects.filter(pk=attempt.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
    assert auto_submit_expired_attempts() == 1
    attempt.refresh_from_db()
    assert attempt.status == "expired"
