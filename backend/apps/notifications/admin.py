from django.contrib import admin

from .models import Announcement, EmailLog, ExportJob, Notification

admin.site.register(Notification)
admin.site.register(Announcement)
admin.site.register(EmailLog)
admin.site.register(ExportJob)
