from django.urls import path

from . import views_public as v

urlpatterns = [
    path("config", v.SiteConfigView.as_view()),
    path("home", v.HomeView.as_view()),
]
