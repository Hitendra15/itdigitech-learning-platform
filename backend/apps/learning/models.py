from django.conf import settings
from django.db import models

from common.models import BaseModel


class LessonProgress(BaseModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey("catalog.Lesson", on_delete=models.CASCADE, related_name="progress")
    completed = models.BooleanField(default=False)
    last_position_seconds = models.PositiveIntegerField(default=0)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "lesson"], name="uniq_progress_user_lesson")]
        indexes = [models.Index(fields=["user", "lesson"]), models.Index(fields=["user", "-updated_at"])]
