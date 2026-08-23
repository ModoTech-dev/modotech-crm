from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ConversationViewSet, GlobalSearchView, InternalMessageViewSet, ParseMapsLinkView

router = DefaultRouter()
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("internal-messages", InternalMessageViewSet, basename="internal-message")

urlpatterns = [
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("parse-maps-link/", ParseMapsLinkView.as_view(), name="parse-maps-link"),
] + router.urls
