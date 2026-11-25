from django.urls import path

from . import views

urlpatterns = [
    path("lessons/<uuid:public_id>/progress", views.LessonProgressView.as_view()),
    path("my/continue-learning", views.ContinueLearningView.as_view()),
]
