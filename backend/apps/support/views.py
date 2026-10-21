from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import FAQ, Ticket
from .serializers import CreateTicketSerializer, FAQSerializer, ReplySerializer, TicketSerializer, thread


class SupportThrottle:
    throttle_scope = "support"


class FAQListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    serializer_class = FAQSerializer
    pagination_class = None
    queryset = FAQ.objects.filter(is_published=True)


class TicketListCreateView(SupportThrottle, APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get(self, request):
        qs = Ticket.objects.filter(user=request.user).prefetch_related("messages")
        if request.query_params.get("status") == "open":
            qs = qs.exclude(status=Ticket.Status.CLOSED)
        return Response(TicketSerializer(qs[:100], many=True).data)

    def post(self, request):
        ser = CreateTicketSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        ticket = services.create_ticket(
            request.user, d["subject"], d["body"], d["category"], d["priority"], d.get("attachment")
        )
        return Response(TicketSerializer(ticket).data, status=status.HTTP_201_CREATED)


def _own(request, public_id):
    return get_object_or_404(Ticket.objects.select_related("user"), public_id=public_id, user=request.user)


class TicketDetailView(APIView):
    def get(self, request, public_id):
        ticket = _own(request, public_id)
        services.mark_read(ticket, staff=False)
        return Response({**TicketSerializer(ticket).data, "messages": thread(ticket, request)})


class TicketReplyView(SupportThrottle, APIView):
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def post(self, request, public_id):
        ticket = _own(request, public_id)
        ser = ReplySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        msg = services.add_message(ticket, request.user, ser.validated_data["body"],
                                   attachment=ser.validated_data.get("attachment"))
        return Response(services.message_payload(msg, request), status=status.HTTP_201_CREATED)


class TicketCloseView(APIView):
    def post(self, request, public_id):
        ticket = _own(request, public_id)
        services.update_ticket(ticket, status=Ticket.Status.CLOSED)
        return Response(TicketSerializer(ticket).data)


class UnreadCountView(APIView):
    def get(self, request):
        return Response({"unread": Ticket.objects.filter(user=request.user, unread_by_student=True).count()})
