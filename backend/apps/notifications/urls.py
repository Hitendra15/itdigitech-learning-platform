from django.urls import path

from . import views

urlpatterns = [
    path("my/notifications", views.NotificationListView.as_view()),
    path("my/notifications/<uuid:public_id>/read", views.NotificationReadView.as_view()),
]
