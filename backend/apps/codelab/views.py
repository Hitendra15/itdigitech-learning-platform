from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.access.services import has_access
from apps.catalog.models import Lesson

from . import runner
from .models import CodeSnippet


class RunSerializer(serializers.Serializer):
    language = serializers.ChoiceField(choices=list(runner.LANGUAGES))
    code = serializers.CharField(max_length=20000, trim_whitespace=False)
    stdin = serializers.CharField(max_length=5000, required=False, allow_blank=True, default="")


class RunCodeView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "code_run"

    def post(self, request):
        ser = RunSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            return Response(runner.run(d["language"], d["code"], d["stdin"]))
        except runner.RunnerUnavailable as e:
            return Response({"detail": str(e)}, status=503)


class LanguagesView(APIView):
    def get(self, request):
        return Response([{"id": k, "label": v["label"]} for k, v in runner.LANGUAGES.items()])


class LessonCodeView(APIView):
    """GET/PUT the student's saved code for a practice lesson."""

    def _lesson(self, request, public_id):
        lesson = get_object_or_404(Lesson.objects.select_related("module__course"), public_id=public_id, is_deleted=False)
        if not has_access(request.user, lesson.course, lesson):
            return None
        return lesson

    def get(self, request, public_id):
        lesson = self._lesson(request, public_id)
        if not lesson:
            return Response({"detail": "No access."}, status=403)
        snip = CodeSnippet.objects.filter(user=request.user, lesson=lesson).first()
        return Response({"code": snip.code if snip else None, "language": snip.language if snip else lesson.language})

    def put(self, request, public_id):
        lesson = self._lesson(request, public_id)
        if not lesson:
            return Response({"detail": "No access."}, status=403)
        code = str(request.data.get("code", ""))[:50000]
        CodeSnippet.objects.update_or_create(
            user=request.user, lesson=lesson,
            defaults={"code": code, "language": str(request.data.get("language") or lesson.language)[:20]},
        )
        return Response({"saved": True})
