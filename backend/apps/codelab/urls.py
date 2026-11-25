from django.urls import path

from . import views

urlpatterns = [
    path("code/run", views.RunCodeView.as_view()),
    path("code/languages", views.LanguagesView.as_view()),
    path("lessons/<uuid:public_id>/code", views.LessonCodeView.as_view()),
]
