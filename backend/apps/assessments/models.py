from django.conf import settings
from django.db import models

from common.models import BaseModel


class Test(BaseModel):
    __test__ = False  # stop pytest collecting this model

    course = models.ForeignKey("catalog.Course", on_delete=models.CASCADE, related_name="tests")
    module = models.ForeignKey("catalog.Module", null=True, blank=True, on_delete=models.SET_NULL, related_name="tests")
    title = models.CharField(max_length=200)
    duration_minutes = models.PositiveIntegerField(default=30)
    pass_percent = models.PositiveIntegerField(default=50)
    max_attempts = models.PositiveIntegerField(default=3)
    is_published = models.BooleanField(default=True)

    def __str__(self):
        return self.title


class Question(BaseModel):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="questions")
    text = models.TextField()
    # [{"id": "a", "text": "..."}, ...]
    options = models.JSONField(default=list)
    # ["a"] for single choice, ["a","c"] for multiple
    correct_answer = models.JSONField(default=list)
    explanation = models.TextField(blank=True)
    marks = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ("order", "id")


class Attempt(BaseModel):
    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        SUBMITTED = "submitted", "Submitted"
        EXPIRED = "expired", "Auto-submitted"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="attempts")
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name="attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()  # authoritative server-side deadline
    submitted_at = models.DateTimeField(null=True, blank=True)
    score = models.PositiveIntegerField(default=0)
    total_marks = models.PositiveIntegerField(default=0)
    passed = models.BooleanField(default=False)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.IN_PROGRESS, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["user", "test"])]


class Answer(BaseModel):
    attempt = models.ForeignKey(Attempt, on_delete=models.CASCADE, related_name="answers")
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    response = models.JSONField(default=list)
    is_correct = models.BooleanField(default=False)
    marks_awarded = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["attempt", "question"], name="uniq_answer_attempt_question")]
