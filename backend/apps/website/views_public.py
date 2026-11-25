from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services


class PublicSiteView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]  # the global anonymous limit is too low for a page that loads several of these
    throttle_scope = "site"


class SiteConfigView(PublicSiteView):
    """Company profile plus every promotion that is live right now."""

    def get(self, request):
        return Response(services.site_config())


class HomeView(PublicSiteView):
    """Published, enabled homepage sections in order. Empty sections are already removed."""

    def get(self, request):
        return Response(services.home_payload())
