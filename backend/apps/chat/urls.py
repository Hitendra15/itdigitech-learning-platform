from django.urls import path

from . import views as v

urlpatterns = [
    path("chat/sessions", v.StartChatView.as_view()),
    path("chat/sessions/<uuid:public_id>", v.ChatStateView.as_view()),
    path("chat/sessions/<uuid:public_id>/messages", v.ChatMessageView.as_view()),
    path("chat/sessions/<uuid:public_id>/human", v.ChatHumanView.as_view()),
    path("chat/sessions/<uuid:public_id>/email", v.ChatEmailView.as_view()),
    path("chat/sessions/<uuid:public_id>/close", v.ChatCloseView.as_view()),
    path("admin-api/chats", v.StaffChatListView.as_view()),
    path("admin-api/chats/counts", v.StaffChatCountView.as_view()),
    path("admin-api/chats/<uuid:public_id>", v.StaffChatDetailView.as_view()),
    path("admin-api/chats/<uuid:public_id>/close", v.StaffChatCloseView.as_view()),
]
