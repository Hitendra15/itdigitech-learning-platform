from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification


def _ser(n):
    return {"id": str(n.public_id), "title": n.title, "body": n.body, "link": n.link,
            "is_read": n.is_read, "created_at": n.created_at}


class NotificationListView(APIView):
    def get(self, request):
        items = Notification.objects.filter(user=request.user)[:30]
        unread = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"results": [_ser(n) for n in items], "unread": unread})

    def post(self, request):  # mark all read
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response(status=204)


class NotificationReadView(APIView):
    def post(self, request, public_id):
        Notification.objects.filter(user=request.user, public_id=public_id).update(is_read=True)
        return Response(status=204)
