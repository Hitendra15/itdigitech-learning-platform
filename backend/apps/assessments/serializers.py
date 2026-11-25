from rest_framework import serializers

from .models import Attempt, Question, Test


class TestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    question_count = serializers.IntegerField(source="questions.count", read_only=True)

    class Meta:
        model = Test
        fields = ("id", "title", "duration_minutes", "pass_percent", "max_attempts", "question_count")


class QuestionPublicSerializer(serializers.ModelSerializer):
    """Never exposes correct_answer / explanation while the attempt is live."""

    id = serializers.UUIDField(source="public_id")
    multiple = serializers.SerializerMethodField()

    class Meta:
        model = Question
        fields = ("id", "text", "options", "marks", "multiple")

    def get_multiple(self, obj):
        return len(obj.correct_answer) > 1


class AttemptSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id")
    test = serializers.CharField(source="test.title")

    class Meta:
        model = Attempt
        fields = ("id", "test", "started_at", "expires_at", "submitted_at", "score", "total_marks", "passed", "status")
