from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.models import Enrollment
from apps.access.services import has_access
from apps.learning.models import LessonProgress

from .models import Course, Lesson
from .serializers import CourseListSerializer, LessonDetailSerializer, ModuleSerializer
from .video import bunny_playback_url


class CourseListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = CourseListSerializer
    pagination_class = None
    queryset = Course.objects.filter(is_published=True, is_deleted=False).order_by("title")


class CurriculumView(APIView):
    """Modules + lessons (+ per-user completion) for a course the user can access."""

    def get(self, request, slug):
        course = get_object_or_404(Course, slug=slug, is_published=True, is_deleted=False)
        if not has_access(request.user, course):
            return Response({"detail": "You do not have access to this course."}, status=403)
        modules = course.modules.filter(is_published=True, is_deleted=False).prefetch_related("lessons")
        completed = set(
            LessonProgress.objects.filter(user=request.user, lesson__module__course=course, completed=True)
            .values_list("lesson__public_id", flat=True)
        )
        data = ModuleSerializer(modules, many=True, context={"completed_ids": completed}).data
        return Response({"course": CourseListSerializer(course).data, "modules": data})


class LessonDetailView(APIView):
    def get(self, request, public_id):
        lesson = get_object_or_404(
            Lesson.objects.select_related("module__course").prefetch_related("notes"),
            public_id=public_id, is_published=True, is_deleted=False,
        )
        if not has_access(request.user, lesson.course, lesson):
            return Response({"detail": "You do not have access to this lesson."}, status=403)
        return Response(LessonDetailSerializer(lesson).data)


class LessonVideoView(APIView):
    def get(self, request, public_id):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course", "video"), public_id=public_id)
        if not has_access(request.user, lesson.course, lesson):
            return Response({"detail": "You do not have access to this lesson."}, status=403)
        video = getattr(lesson, "video", None)
        if not video:
            return Response({"detail": "No video for this lesson."}, status=404)
        return Response({"url": bunny_playback_url(video.provider_path), "provider": video.provider})


class MyCoursesView(APIView):
    def get(self, request):
        from apps.learning.services import course_progress_percent

        enrollments = Enrollment.objects.active().filter(user=request.user).select_related("course")
        out = []
        for e in enrollments:
            out.append(
                {
                    **CourseListSerializer(e.course).data,
                    "expires_at": e.expires_at,
                    "progress": course_progress_percent(request.user, e.course),
                }
            )
        return Response(out)
