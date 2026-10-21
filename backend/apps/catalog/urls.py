from django.urls import path

from . import views

urlpatterns = [
    path("courses", views.CourseListView.as_view()),
    path("my/courses", views.MyCoursesView.as_view()),
    path("my/courses/<slug:slug>/curriculum", views.CurriculumView.as_view()),
    path("lessons/<uuid:public_id>", views.LessonDetailView.as_view()),
    path("lessons/<uuid:public_id>/video", views.LessonVideoView.as_view()),
]
