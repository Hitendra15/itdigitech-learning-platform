from django.contrib import admin

from .models import Certificate


@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ("code", "recipient_name", "course_title", "issued_at", "revoked")
    list_filter = ("revoked",)
    search_fields = ("code", "recipient_name", "user__email")
