from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import LoginView, LogoutView, MeView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

auth_urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("me/", MeView.as_view(), name="auth-me"),
]

urlpatterns = [
    path("auth/", include(auth_urlpatterns)),
    path("", include(router.urls)),
]
