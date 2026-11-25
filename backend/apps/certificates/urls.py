from django.urls import path

from . import views

urlpatterns = [
    path("my/certificates", views.MyCertificatesView.as_view()),
    path("my/courses/<slug:slug>/certificate", views.CourseCertificateView.as_view()),
    path("certificates/<str:code>/download", views.DownloadCertificateView.as_view()),
    path("certificates/verify/<str:code>", views.VerifyCertificateView.as_view()),
    path("admin-api/certificates", views.StaffCertificateListView.as_view()),
    path("admin-api/certificates/<uuid:public_id>/revoke", views.StaffCertificateRevokeView.as_view()),
]
