from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access.services import has_access

from . import services
from .models import Attempt, Test
from .serializers import AttemptSerializer, QuestionPublicSerializer, TestSerializer


class CourseTestsView(APIView):
    def get(self, request, slug):
        tests = Test.objects.filter(course__slug=slug, is_published=True).select_related("course")
        tests = [t for t in tests if has_access(request.user, t.course)]
        return Response(TestSerializer(tests, many=True).data)


class StartAttemptView(APIView):
    def post(self, request, public_id):
        test = get_object_or_404(Test.objects.select_related("course"), public_id=public_id, is_published=True)
        attempt = services.start_attempt(request.user, test)
        answered = {str(a.question.public_id): a.response for a in attempt.answers.select_related("question")}
        return Response(
            {
                "attempt": AttemptSerializer(attempt).data,
                "questions": QuestionPublicSerializer(test.questions.all(), many=True).data,
                "answers": answered,
            }
        )


class AnswerView(APIView):
    def post(self, request, public_id):
        attempt = get_object_or_404(Attempt, public_id=public_id, user=request.user)
        services.save_answer(attempt, request.data.get("question_id"), request.data.get("response", []))
        return Response({"saved": True})


class SubmitView(APIView):
    def post(self, request, public_id):
        attempt = get_object_or_404(Attempt, public_id=public_id, user=request.user)
        attempt = services.grade_attempt(attempt)
        return Response(AttemptSerializer(attempt).data)


class ResultView(APIView):
    """Correct answers and explanations are only revealed after submission."""

    def get(self, request, public_id):
        attempt = get_object_or_404(Attempt.objects.select_related("test"), public_id=public_id, user=request.user)
        if attempt.status == Attempt.Status.IN_PROGRESS:
            return Response({"detail": "Attempt not submitted yet."}, status=409)
        answers = {a.question_id: a for a in attempt.answers.all()}
        review = []
        for q in attempt.test.questions.all():
            a = answers.get(q.id)
            review.append(
                {
                    "id": str(q.public_id), "text": q.text, "options": q.options,
                    "your_answer": a.response if a else [], "correct_answer": q.correct_answer,
                    "is_correct": a.is_correct if a else False, "explanation": q.explanation,
                }
            )
        return Response({"attempt": AttemptSerializer(attempt).data, "review": review})


class MyAttemptsView(APIView):
    def get(self, request):
        qs = Attempt.objects.filter(user=request.user).select_related("test").order_by("-started_at")[:50]
        return Response(AttemptSerializer(qs, many=True).data)
