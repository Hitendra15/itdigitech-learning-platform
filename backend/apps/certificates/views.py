from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.catalog.models import Course

from . import services
from .models import Certificate


def cert_data(c):
    return {
        "id": str(c.public_id), "code": c.code, "course_title": c.course_title, "course_slug": c.course.slug,
        "recipient_name": c.recipient_name, "issued_at": c.issued_at, "average_score": c.average_score,
        "revoked": c.revoked, "verify_url": services.verify_url(c),
    }


class MyCertificatesView(APIView):
    def get(self, request):
        qs = Certificate.objects.filter(user=request.user, revoked=False).select_related("course")
        return Response([cert_data(c) for c in qs])


class CourseCertificateView(APIView):
    """GET: what is left to do. POST: claim the certificate once everything is done."""

    def _course(self, slug):
        return get_object_or_404(Course, slug=slug, is_published=True, is_deleted=False)

    def get(self, request, slug):
        course = self._course(slug)
        state = services.eligibility(request.user, course)
        cert = Certificate.objects.filter(user=request.user, course=course, revoked=False).select_related("course").first()
        return Response({**state, "certificate": cert_data(cert) if cert else None})

    def post(self, request, slug):
        course = self._course(slug)
        try:
            cert = services.issue_certificate(request.user, course)
        except services.NotEligible as e:
            return Response({"detail": str(e), "todo": e.todo}, status=400)
        if cert.revoked:
            return Response({"detail": "This certificate was withdrawn. Contact support."}, status=403)
        return Response(cert_data(cert), status=201)


class DownloadCertificateView(APIView):
    def get(self, request, code):
        cert = get_object_or_404(Certificate.objects.select_related("course"), code=code.upper())
        if cert.user_id != request.user.id and request.user.role != "admin":
            return Response({"detail": "Not found."}, status=404)
        if cert.revoked:
            return Response({"detail": "This certificate was withdrawn."}, status=403)
        resp = HttpResponse(services.render_pdf(cert), content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="IT-DigiTech-Certificate-{cert.code}.pdf"'
        return resp


class VerifyCertificateView(APIView):
    """Public: employers and colleges check a certificate ID or scan the QR code."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "verify"

    def get(self, request, code):
        cert = Certificate.objects.filter(code=code.strip().upper()).first()
        if not cert:
            return Response({"valid": False, "detail": "No certificate with this ID."}, status=404)
        if cert.revoked:
            return Response({"valid": False, "detail": "This certificate has been withdrawn.", "code": cert.code})
        return Response({
            "valid": True, "code": cert.code, "recipient_name": cert.recipient_name, "course_title": cert.course_title,
            "issued_at": cert.issued_at, "average_score": cert.average_score,
        })


# ------------------------------------------------------------------ staff
from common.permissions import IsAdminRole  # noqa: E402


class StaffCertificateListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = Certificate.objects.select_related("course", "user").order_by("-issued_at")
        q = request.query_params.get("search", "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(code__icontains=q) | Q(recipient_name__icontains=q) | Q(user__email__icontains=q))
        return Response([{**cert_data(c), "email": c.user.email, "revoked_reason": c.revoked_reason} for c in qs[:200]])


class StaffCertificateRevokeView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, public_id):
        c = get_object_or_404(Certificate, public_id=public_id)
        restore = bool(request.data.get("restore"))
        c.revoked = not restore
        c.revoked_reason = "" if restore else str(request.data.get("reason", ""))[:200]
        c.save(update_fields=["revoked", "revoked_reason", "updated_at"])
        return Response({"id": str(c.public_id), "revoked": c.revoked})
