from django.contrib import admin

from .models import FAQ, Ticket, TicketMessage

admin.site.register(FAQ)
admin.site.register(TicketMessage)


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("reference", "subject", "user", "status", "priority", "last_message_at")
    list_filter = ("status", "priority", "category")
