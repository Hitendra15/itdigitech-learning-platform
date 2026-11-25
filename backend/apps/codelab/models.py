from django.conf import settings
from django.db import models

from common.models import BaseModel


class CodeSnippet(BaseModel):
    """A student's saved work for one practice lesson, so it is there next time they open it."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="snippets")
    lesson = models.ForeignKey("catalog.Lesson", on_delete=models.CASCADE, related_name="snippets")
    language = models.CharField(max_length=20)
    code = models.TextField(max_length=50000)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "lesson"], name="uniq_snippet_user_lesson")]
