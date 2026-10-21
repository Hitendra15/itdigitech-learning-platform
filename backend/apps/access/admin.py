from django.contrib import admin

from .models import Enrollment


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("user", "course", "status", "expires_at")
    list_filter = ("status", "course")
    search_fields = ("user__email",)
