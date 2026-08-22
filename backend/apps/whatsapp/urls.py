from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WhatsAppWebhookView, MessageTemplateViewSet, BroadcastViewSet

router = DefaultRouter()
router.register("templates", MessageTemplateViewSet, basename="whatsapp-template")
router.register("broadcasts", BroadcastViewSet, basename="whatsapp-broadcast")

urlpatterns = [
    path("webhook/", WhatsAppWebhookView.as_view(), name="whatsapp-webhook"),
    path("", include(router.urls)),
]
