from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.services import has_access
from apps.catalog.models import Lesson

from .models import LessonProgress
from .services import course_progress_percent


class LessonProgressView(APIView):
    def post(self, request, public_id):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), public_id=public_id)
        if not has_access(request.user, lesson.course, lesson):
            return Response({"detail": "No access."}, status=403)
        progress, _ = LessonProgress.objects.get_or_create(user=request.user, lesson=lesson)
        if "position" in request.data:
            progress.last_position_seconds = max(0, int(request.data["position"]))
        if request.data.get("completed") and not progress.completed:
            progress.completed = True
            progress.completed_at = timezone.now()
        progress.save()
        return Response(
            {"completed": progress.completed, "course_progress": course_progress_percent(request.user, lesson.course)}
        )


class ContinueLearningView(APIView):
    def get(self, request):
        last = (
            LessonProgress.objects.filter(user=request.user)
            .select_related("lesson__module__course")
            .order_by("-updated_at")
            .first()
        )
        if not last:
            return Response(None)
        lesson = last.lesson
        return Response(
            {
                "course_slug": lesson.course.slug,
                "course_title": lesson.course.title,
                "lesson_id": str(lesson.public_id),
                "lesson_title": lesson.title,
            }
        )
