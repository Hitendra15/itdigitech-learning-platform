from django.db import models

from common.models import BaseModel, SoftDeleteModel


class Course(BaseModel, SoftDeleteModel):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    description = models.TextField(blank=True)
    thumbnail = models.ImageField(upload_to="courses/", blank=True)
    level = models.CharField(max_length=30, default="beginner")
    is_published = models.BooleanField(default=False)
    # Configurable completion rules, e.g.
    # {"min_progress": 90, "pass_percent": 50, "lab_required": false, "project_required": false}
    rule_config = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.title


class Module(BaseModel, SoftDeleteModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="modules")
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ("order", "id")

    def __str__(self):
        return f"{self.course.title} / {self.title}"


class Lesson(BaseModel, SoftDeleteModel):
    class Type(models.TextChoices):
        VIDEO = "video", "Video"
        NOTE = "note", "Note"
        PRACTICE = "practice", "Practice"
        TEST = "test", "Test"
        PROJECT = "project", "Project"

    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    title = models.CharField(max_length=200)
    lesson_type = models.CharField(max_length=20, choices=Type.choices, default=Type.VIDEO)
    order = models.PositiveIntegerField(default=0)
    duration_seconds = models.PositiveIntegerField(default=0)
    is_free_preview = models.BooleanField(default=False)
    is_published = models.BooleanField(default=True)

    class Meta:
        ordering = ("order", "id")
        indexes = [models.Index(fields=["module", "order"])]

    @property
    def course(self):
        return self.module.course

    def __str__(self):
        return self.title


class VideoAsset(BaseModel):
    lesson = models.OneToOneField(Lesson, on_delete=models.CASCADE, related_name="video")
    provider = models.CharField(max_length=30, default="bunny")
    # For token-auth CDNs this is the file path, e.g. /python/intro/playlist.m3u8
    provider_path = models.CharField(max_length=500)


class Note(BaseModel):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="notes")
    title = models.CharField(max_length=200)
    file = models.FileField(upload_to="notes/", blank=True)
    content = models.TextField(blank=True, help_text="Markdown / plain text")
