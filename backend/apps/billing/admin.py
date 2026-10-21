from django.contrib import admin

from .models import Coupon, Invoice, Order, Payment, Plan, WebhookEvent


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("name", "plan_type", "price", "validity_days", "is_active")
    filter_horizontal = ("courses",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("public_id", "user", "plan", "total", "status", "created_at")
    list_filter = ("status", "plan")
    search_fields = ("user__email", "razorpay_order_id")
    date_hierarchy = "created_at"


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("razorpay_payment_id", "order", "method", "status", "amount", "created_at")
    list_filter = ("status", "method")


admin.site.register(Coupon)
admin.site.register(Invoice)
admin.site.register(WebhookEvent)
