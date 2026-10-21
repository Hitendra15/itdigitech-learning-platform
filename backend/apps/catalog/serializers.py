from rest_framework import serializers

from .models import Course, Lesson, Module, Note


class CourseListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")

    class Meta:
        model = Course
        fields = ("id", "title", "slug", "description", "level")


class NoteSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()

    class Meta:
        model = Note
        fields = ("title", "content", "file")

    def get_file(self, obj):
        return obj.file.url if obj.file else None


class LessonBriefSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = ("id", "title", "lesson_type", "duration_seconds", "is_free_preview", "completed")

    def get_completed(self, obj):
        return obj.public_id in self.context.get("completed_ids", set())


class ModuleSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    lessons = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ("id", "title", "lessons")

    def get_lessons(self, obj):
        qs = [l for l in obj.lessons.all() if l.is_published and not l.is_deleted]
        return LessonBriefSerializer(qs, many=True, context=self.context).data


class LessonDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    notes = NoteSerializer(many=True, read_only=True)
    course_slug = serializers.CharField(source="module.course.slug", read_only=True)

    class Meta:
        model = Lesson
        fields = ("id", "title", "lesson_type", "duration_seconds", "notes", "course_slug")
