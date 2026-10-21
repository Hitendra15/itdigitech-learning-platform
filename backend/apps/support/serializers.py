from rest_framework import serializers

from .models import FAQ, Ticket, validate_attachment
from .services import message_payload


class FAQSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)

    class Meta:
        model = FAQ
        fields = ("id", "question", "answer", "category", "order", "is_published")


class TicketSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source="public_id", read_only=True)
    reference = serializers.CharField(read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    unread = serializers.BooleanField(source="unread_by_student", read_only=True)
    preview = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = ("id", "reference", "subject", "category", "category_label", "priority", "priority_label",
                  "status", "status_label", "unread", "last_message_at", "created_at", "preview")

    def get_preview(self, obj):
        last = [m for m in obj.messages.all() if not m.is_internal_note]
        return last[-1].body[:120] if last else ""


class CreateTicketSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=200, min_length=5)
    body = serializers.CharField(min_length=10, max_length=5000)
    category = serializers.ChoiceField(choices=Ticket.Category.choices, default=Ticket.Category.OTHER)
    priority = serializers.ChoiceField(choices=[("low", "Low"), ("normal", "Normal"), ("high", "High")], default="normal")
    attachment = serializers.FileField(required=False, validators=[validate_attachment])


class ReplySerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1, max_length=5000)
    attachment = serializers.FileField(required=False, validators=[validate_attachment])


def thread(ticket, request, include_internal=False):
    msgs = ticket.messages.select_related("author", "author__profile")
    if not include_internal:
        msgs = msgs.filter(is_internal_note=False)
    return [message_payload(m, request) for m in msgs]
