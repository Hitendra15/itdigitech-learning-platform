from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views as v
from . import views_ops as ops

router = DefaultRouter(trailing_slash=False)
router.register("users", v.UserViewSet, basename="admin-user")
router.register("courses", v.CourseViewSet, basename="admin-course")
router.register("modules", v.ModuleViewSet, basename="admin-module")
router.register("lessons", v.LessonViewSet, basename="admin-lesson")
router.register("tests", v.TestViewSet, basename="admin-test")
router.register("questions", v.QuestionViewSet, basename="admin-question")
router.register("attempts", v.AttemptViewSet, basename="admin-attempt")
router.register("plans", v.PlanViewSet, basename="admin-plan")
router.register("coupons", v.CouponViewSet, basename="admin-coupon")
router.register("orders", v.OrderViewSet, basename="admin-order")
router.register("tickets", v.TicketViewSet, basename="admin-ticket")
router.register("faqs", v.FAQViewSet, basename="admin-faq")
router.register("announcements", v.AnnouncementViewSet, basename="admin-announcement")
router.register("flags", v.FeatureFlagViewSet, basename="admin-flag")
router.register("site-settings", v.SiteSettingViewSet, basename="admin-setting")
router.register("audit-log", v.AuditLogViewSet, basename="admin-audit")
router.register("email-log", v.EmailLogViewSet, basename="admin-email")
router.register("exports", v.ExportViewSet, basename="admin-export")
router.register("colleges", ops.OrganizationViewSet, basename="admin-college")
router.register("enrollments", ops.EnrollmentViewSet, basename="admin-enrollment")
router.register("payment-events", ops.WebhookEventViewSet, basename="admin-payment-event")

urlpatterns = [
    path("dashboard", v.DashboardView.as_view()),
    path("staff", v.StaffListView.as_view()),
    path("setup", ops.SetupStatusView.as_view()),
    path("search", ops.SearchView.as_view()),
    path("orders/quote", ops.QuoteView.as_view()),
    path("orders/offline", ops.OfflinePaymentView.as_view()),
    path("", include(router.urls)),
]
