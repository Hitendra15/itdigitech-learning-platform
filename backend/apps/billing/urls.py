from django.urls import path

from . import views

urlpatterns = [
    path("plans", views.PlanListView.as_view()),
    path("orders", views.CreateOrderView.as_view()),
    path("verify", views.VerifyPaymentView.as_view()),
    path("coupons/validate", views.CouponValidateView.as_view()),
    path("payments", views.PaymentHistoryView.as_view()),
    path("webhooks/razorpay", views.RazorpayWebhookView.as_view()),
]
