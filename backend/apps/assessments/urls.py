from django.urls import path

from . import views

urlpatterns = [
    path("courses/<slug:slug>/tests", views.CourseTestsView.as_view()),
    path("tests/<uuid:public_id>/start", views.StartAttemptView.as_view()),
    path("attempts/<uuid:public_id>/answer", views.AnswerView.as_view()),
    path("attempts/<uuid:public_id>/submit", views.SubmitView.as_view()),
    path("attempts/<uuid:public_id>/result", views.ResultView.as_view()),
    path("my/attempts", views.MyAttemptsView.as_view()),
]
