from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views_admin as v

router = DefaultRouter(trailing_slash=False)
router.register("sections", v.SectionViewSet, basename="web-section")
router.register("promotions", v.PromotionViewSet, basename="web-promotion")
router.register("media", v.MediaViewSet, basename="web-media")

urlpatterns = [
    path("schema", v.SchemaView.as_view()),
    path("profile", v.ProfileView.as_view()),
    path("home/status", v.HomeStatusView.as_view()),
    path("home/preview", v.HomePreviewView.as_view()),
    path("home/publish", v.HomePublishView.as_view()),
    path("home/discard", v.HomeDiscardView.as_view()),
    path("", include(router.urls)),
]
