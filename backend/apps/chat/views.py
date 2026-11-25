from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from common.permissions import IsAdminRole

from . import services
from .models import ChatSession


class StartSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    email = serializers.EmailField(required=False, allow_blank=True)
    message = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    page = serializers.CharField(max_length=300, required=False, allow_blank=True)


class BodySerializer(serializers.Serializer):
    body = serializers.CharField(max_length=2000)


class PublicChatView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"


def _session(public_id):
    return get_object_or_404(ChatSession, public_id=public_id)


def _full(session):
    return {**services.session_payload(session), "messages": [services.message_payload(m) for m in session.messages.select_related("author")]}


class StartChatView(PublicChatView):
    def post(self, request):
        ser = StartSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        user = request.user if request.user.is_authenticated else None
        email = d.get("email") or (user.email if user else "")
        session = services.start_session(d["name"], email, user, d.get("page", ""), d.get("message", ""))
        session.refresh_from_db()
        return Response(_full(session), status=201)


class ChatStateView(PublicChatView):
    """Fallback for when the WebSocket is blocked: the widget polls this every few seconds."""

    throttle_scope = "chat_poll"

    def get(self, request, public_id):
        session = _session(public_id)
        services.touch_seen(session)
        return Response(_full(session))


class ChatMessageView(PublicChatView):
    def post(self, request, public_id):
        session = _session(public_id)
        ser = BodySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.post_visitor_message(session, ser.validated_data["body"])
        session.refresh_from_db()
        return Response(_full(session), status=201)


class ChatHumanView(PublicChatView):
    def post(self, request, public_id):
        session = _session(public_id)
        services.escalate(session)
        session.refresh_from_db()
        return Response(_full(session))


class ChatEmailView(PublicChatView):
    """Visitor adds an email mid-chat so a reply is not lost if they leave."""

    def post(self, request, public_id):
        session = _session(public_id)
        ser = serializers.EmailField().run_validation(request.data.get("email", ""))
        session.visitor_email = ser
        session.save(update_fields=["visitor_email", "updated_at"])
        return Response(_full(session))


class ChatCloseView(PublicChatView):
    def post(self, request, public_id):
        session = _session(public_id)
        services.close_session(session)
        session.refresh_from_db()
        return Response(_full(session))


# ------------------------------------------------------------------ staff
def _row(s):
    last = s.messages.last()
    return {**services.session_payload(s), "visitor_email": s.visitor_email, "page_url": s.page_url,
            "is_student": bool(s.user_id), "unread": s.unread_by_staff, "last_message_at": s.last_message_at,
            "assigned_to": s.assigned_to.email if s.assigned_to else None,
            "preview": (last.body[:90] if last else "")}


class StaffChatListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = ChatSession.objects.select_related("assigned_to").order_by("-last_message_at")
        st = request.query_params.get("status")
        qs = qs.exclude(status="closed") if st == "active" else qs.filter(status=st) if st else qs
        return Response([_row(s) for s in qs[:100]])


class StaffChatDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, public_id):
        s = _session(public_id)
        if s.unread_by_staff:
            s.unread_by_staff = False
            s.save(update_fields=["unread_by_staff"])
        return Response({**_full(s), **_row(s)})

    def post(self, request, public_id):
        s = _session(public_id)
        ser = BodySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        services.agent_reply(s, request.user, ser.validated_data["body"])
        s.refresh_from_db()
        return Response({**_full(s), **_row(s)}, status=201)


class StaffChatCloseView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, public_id):
        s = _session(public_id)
        services.close_session(s, by_staff=True)
        s.refresh_from_db()
        return Response({**_full(s), **_row(s)})


class StaffChatCountView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({"waiting": ChatSession.objects.filter(status="waiting").count(),
                         "unread": ChatSession.objects.filter(unread_by_staff=True).exclude(status="closed").count()})
