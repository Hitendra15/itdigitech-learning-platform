from django.urls import path

from . import views

urlpatterns = [
    path("support/faqs", views.FAQListView.as_view()),
    path("support/tickets", views.TicketListCreateView.as_view()),
    path("support/unread", views.UnreadCountView.as_view()),
    path("support/tickets/<uuid:public_id>", views.TicketDetailView.as_view()),
    path("support/tickets/<uuid:public_id>/messages", views.TicketReplyView.as_view()),
    path("support/tickets/<uuid:public_id>/close", views.TicketCloseView.as_view()),
]
