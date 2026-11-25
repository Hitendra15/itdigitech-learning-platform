from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.access.services import has_access

from .models import Answer, Attempt, Question, Test


def start_attempt(user, test: Test) -> Attempt:
    if not has_access(user, test.course):
        raise PermissionDenied("You do not have access to this course.")
    # Resume an unexpired attempt instead of burning another one
    live = Attempt.objects.filter(
        user=user, test=test, status=Attempt.Status.IN_PROGRESS, expires_at__gt=timezone.now()
    ).first()
    if live:
        return live
    used = Attempt.objects.filter(user=user, test=test).count()
    if used >= test.max_attempts:
        raise ValidationError({"detail": "You have used all attempts for this test."})
    now = timezone.now()
    return Attempt.objects.create(user=user, test=test, expires_at=now + timedelta(minutes=test.duration_minutes))


def save_answer(attempt: Attempt, question_public_id, response):
    if attempt.status != Attempt.Status.IN_PROGRESS or attempt.expires_at <= timezone.now():
        raise ValidationError({"detail": "This attempt is closed."})
    question = Question.objects.filter(public_id=question_public_id, test=attempt.test).first()
    if not question:
        raise ValidationError({"detail": "Question not part of this test."})
    if not isinstance(response, list):
        response = [response]
    Answer.objects.update_or_create(attempt=attempt, question=question, defaults={"response": response})


@transaction.atomic
def grade_attempt(attempt: Attempt, expired=False) -> Attempt:
    attempt = Attempt.objects.select_for_update().get(pk=attempt.pk)
    if attempt.status != Attempt.Status.IN_PROGRESS:
        return attempt
    answers = {a.question_id: a for a in attempt.answers.all()}
    score = total = 0
    for q in attempt.test.questions.all():
        total += q.marks
        a = answers.get(q.id)
        if not a:
            continue
        ok = set(map(str, a.response)) == set(map(str, q.correct_answer))
        a.is_correct = ok
        a.marks_awarded = q.marks if ok else 0
        a.save(update_fields=["is_correct", "marks_awarded"])
        score += a.marks_awarded
    attempt.score, attempt.total_marks = score, total
    attempt.passed = bool(total) and (score * 100 / total) >= attempt.test.pass_percent
    attempt.status = Attempt.Status.EXPIRED if expired else Attempt.Status.SUBMITTED
    attempt.submitted_at = timezone.now()
    attempt.save()
    return attempt
