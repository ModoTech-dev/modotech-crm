import json
import logging

from django.conf import settings
from django.http import HttpResponse, HttpResponseForbidden
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action

from .services.webhook_security import verify_signature
from .tasks import process_webhook_event

logger = logging.getLogger("apps.whatsapp")


@method_decorator(csrf_exempt, name="dispatch")
class WhatsAppWebhookView(APIView):
    """
    GET  — Meta's webhook verification handshake.
    POST — actual event delivery. Must respond 200 fast; all real work
    happens in a Celery task (spec sections 4 and 36).
    """

    authentication_classes = []
    permission_classes = []
    throttle_scope = "whatsapp-webhook"

    def get(self, request):
        mode = request.GET.get("hub.mode")
        token = request.GET.get("hub.verify_token")
        challenge = request.GET.get("hub.challenge", "")

        if mode == "subscribe" and token == settings.WHATSAPP_VERIFY_TOKEN:
            return HttpResponse(challenge, content_type="text/plain")
        return HttpResponseForbidden("Verification failed.")

    def post(self, request):
        if not verify_signature(request.body, request.headers):
            logger.warning("Rejected WhatsApp webhook with invalid signature.")
            return Response(status=403)

        try:
            payload = json.loads(request.body)
        except ValueError:
            return Response(status=400)

        process_webhook_event.delay(payload)
        return Response(status=200)


from rest_framework import viewsets
from apps.accounts.permissions import IsAdminOrAbove
from .models import MessageTemplate
from .serializers import MessageTemplateSerializer


class MessageTemplateViewSet(viewsets.ModelViewSet):
    queryset = MessageTemplate.objects.all()
    serializer_class = MessageTemplateSerializer
    permission_classes = [IsAdminOrAbove]


from .models import Broadcast
from .serializers import BroadcastRecipientSerializer, BroadcastSerializer
from .tasks_broadcast import send_broadcast


class BroadcastViewSet(viewsets.ModelViewSet):
    queryset = Broadcast.objects.select_related("template").all()
    serializer_class = BroadcastSerializer
    permission_classes = [IsAdminOrAbove]
    http_method_names = ["get", "post", "head", "options"]  # broadcasts aren't edited once created

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        broadcast = self.get_object()
        if broadcast.status != "DRAFT":
            return Response({"detail": "This broadcast has already been sent or is sending."}, status=400)
        # The task itself owns every status transition (DRAFT -> SENDING ->
        # COMPLETED/FAILED) as its very first and very last actions. The
        # view must NOT also write status here — with a real async worker,
        # or even Celery's eager-execution test mode, the task can finish
        # and set COMPLETED before this line would run, and a write here
        # would silently clobber that back to SENDING.
        send_broadcast.delay(str(broadcast.id))
        broadcast.refresh_from_db()
        return Response(BroadcastSerializer(broadcast).data)

    @action(detail=True, methods=["get"])
    def recipients(self, request, pk=None):
        broadcast = self.get_object()
        return Response(
            BroadcastRecipientSerializer(
                broadcast.recipients.select_related("customer"), many=True, context={"request": request}
            ).data
        )
