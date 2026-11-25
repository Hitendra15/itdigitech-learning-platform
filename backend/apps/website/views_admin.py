import json

from django.db.models import Max
from django.http import Http404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.adminpanel.models import AuditLog
from apps.adminpanel.views import AdminBase, AuditedModelViewSet
from common.permissions import IsAdminRole

from . import schemas, services
from .models import HomeSection, MediaAsset, PromoBanner
from .serializers import (MediaSerializer, MediaUploadSerializer, PromoSerializer, SectionSerializer, SectionWriteSerializer)


def _audit(request, action_name, target_type, obj_id, summary):
    AuditLog.objects.create(actor=request.user, action=action_name, target_type=target_type, target_id=str(obj_id), summary=str(summary)[:200])


class SchemaView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response(schemas.public_schema())


# ------------------------------------------------------------------ homepage
class SectionViewSet(AdminBase, viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                     mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin):
    serializer_class = SectionSerializer
    pagination_class = None
    queryset = HomeSection.objects.all()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    audit_name = "Homepage section"

    def list(self, request, *args, **kwargs):
        rows = sorted(self.get_queryset(), key=lambda s: (s.effective(True)["order"], s.id))
        return Response(self.get_serializer(rows, many=True).data)

    def create(self, request, *args, **kwargs):
        w = SectionWriteSerializer(data=request.data, context={"instance": None})
        w.is_valid(raise_exception=True)
        stype = w.validated_data["section_type"]
        top = HomeSection.objects.aggregate(m=Max("order"))["m"] or 0
        s = HomeSection.objects.create(section_type=stype, label=w.validated_data.get("label", ""), order=top + 10,
                                       is_enabled=False, content=schemas.default_content(stype))
        s.stage(is_enabled=True)  # appears on the site only after the next publish
        self._log("created", s)
        return Response(SectionSerializer(s).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        s = self.get_object()
        w = SectionWriteSerializer(data=request.data, partial=True, context={"instance": s})
        w.is_valid(raise_exception=True)
        d = w.validated_data
        s.stage(content=d.get("content"), is_enabled=d.get("is_enabled"), label=d.get("label"))
        self._log("drafted", s)
        return Response(SectionSerializer(s).data)

    def perform_destroy(self, instance):
        self._log("deleted", instance)
        instance.delete()

    @action(detail=False, methods=["post"])
    def reorder(self, request):
        ids = request.data.get("ids", [])
        rows = {str(s.public_id): s for s in HomeSection.objects.all()}
        if not isinstance(ids, list) or set(ids) != set(rows):
            return Response({"detail": "Send every section id in the order you want."}, status=400)
        for i, pid in enumerate(ids, start=1):
            if rows[pid].effective(True)["order"] != i * 10:
                rows[pid].stage(order=i * 10)
        _audit(request, "reordered", "Homepage sections", "-", "Changed section order")
        return Response({"reordered": len(ids)})

    @action(detail=True, methods=["post"])
    def discard(self, request, public_id=None):
        s = self.get_object()
        s.draft = None
        s.save(update_fields=["draft", "updated_at"])
        self._log("discarded draft", s)
        return Response(SectionSerializer(s).data)


class HomeStatusView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        pending = HomeSection.objects.exclude(draft__isnull=True).count()
        last = HomeSection.objects.exclude(published_at__isnull=True).order_by("-published_at").values_list("published_at", flat=True).first()
        return Response({"pending": pending, "last_published_at": last})


class HomePreviewView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({**services.home_payload(preview=True), **services.site_config()})


class HomePublishView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        n = services.publish_home()
        _audit(request, "published", "Homepage", "-", f"Published {n} section change(s)")
        return Response({"published": n})


class HomeDiscardView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        n = services.discard_home()
        _audit(request, "discarded", "Homepage", "-", f"Discarded {n} draft(s)")
        return Response({"discarded": n})


# ------------------------------------------------------------------ promotions
class PromotionViewSet(AuditedModelViewSet):
    serializer_class = PromoSerializer
    pagination_class = None
    queryset = PromoBanner.objects.select_related("coupon", "desktop_image", "mobile_image")
    search_fields = ("name", "title")
    audit_name = "Promotion"

    def get_queryset(self):
        qs = super().get_queryset()
        want = self.request.query_params.get("status")
        if want and self.action == "list":
            return [b for b in qs if b.status() == want]
        return qs

    @action(detail=True, methods=["post"])
    def duplicate(self, request, public_id=None):
        src = self.get_object()
        copy = PromoBanner.objects.create(
            name=f"{src.name} (copy)"[:120], title=src.title, description=src.description, badge_text=src.badge_text,
            cta_label=src.cta_label, cta_url=src.cta_url, desktop_image=src.desktop_image, mobile_image=src.mobile_image,
            placements=src.placements, theme=src.theme, coupon=src.coupon, show_countdown=False, priority=src.priority,
            is_active=False, starts_at=None, ends_at=None)
        self._log("duplicated", copy)
        return Response(PromoSerializer(copy).data, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------ media
class MediaViewSet(AdminBase, viewsets.GenericViewSet, mixins.ListModelMixin, mixins.RetrieveModelMixin,
                   mixins.CreateModelMixin, mixins.UpdateModelMixin, mixins.DestroyModelMixin):
    serializer_class = MediaSerializer
    queryset = MediaAsset.objects.select_related("uploaded_by")
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ("name", "alt_text")
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    audit_name = "Media"

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.action in ("list", "retrieve"):
            blob = json.dumps([[s.content, s.draft] for s in HomeSection.objects.all()] + [services.get_profile(raw=True)])
            promo_ids = set()
            for p in PromoBanner.objects.all():
                promo_ids.update(str(i) for i in (p.desktop_image.public_id if p.desktop_image_id else None, p.mobile_image.public_id if p.mobile_image_id else None) if i)
            ctx["usage"] = {str(a): (blob.count(str(a)) + (1 if str(a) in promo_ids else 0))
                            for a in MediaAsset.objects.values_list("public_id", flat=True)}
        return ctx

    def create(self, request, *args, **kwargs):
        up = MediaUploadSerializer(data=request.data)
        up.is_valid(raise_exception=True)
        asset = services.create_asset(up.validated_data["image"], request.user, up.validated_data.get("alt_text", ""))
        self._log("uploaded", asset)
        return Response(MediaSerializer(asset).data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        self._log("updated", serializer.save())

    def destroy(self, request, *args, **kwargs):
        asset = self.get_object()
        uses = services.asset_usage(asset)
        if uses:
            names = ", ".join(u["label"] for u in uses[:3])
            return Response({"detail": f"This image is still used by {names}{' and more' if len(uses) > 3 else ''}. Replace it there first.", "usage": uses},
                            status=status.HTTP_409_CONFLICT)
        self._log("deleted", asset)
        asset.image.delete(save=False)
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ------------------------------------------------------------------ company profile
class ProfileView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({"values": services.get_profile(raw=True), "fields": schemas.PROFILE_FIELDS})

    def put(self, request):
        services.save_profile(request.data)
        _audit(request, "updated", "Website profile", "-", "Company profile and SEO")
        return Response({"values": services.get_profile(raw=True)})
