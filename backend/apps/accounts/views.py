from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView  # noqa: F401  (re-exported via urls)

from apps.integrations.services.audit import log_action
from .models import Role, User
from .permissions import IsSuperAdminOnly
from .serializers import LoginSerializer, UserCreateSerializer, UserSerializer


class LoginView(APIView):
    permission_classes = []
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)
        log_action(user=user, action="LOGIN", request=request)
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        log_action(user=request.user, action="LOGOUT", request=request)
        try:
            RefreshToken(request.data.get("refresh")).blacklist()
        except Exception:
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserViewSet(viewsets.ModelViewSet):
    """
    Admin-only user management: create agents/managers, disable users,
    change roles. Regular users hit /api/auth/me/ instead.
    """

    queryset = User.objects.all().order_by("first_name")
    permission_classes = [IsSuperAdminOnly]
    filterset_fields = ["role", "is_active", "department"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    @action(detail=True, methods=["post"])
    def disable(self, request, pk=None):
        user = self.get_object()
        user.is_active = False
        user.save(update_fields=["is_active"])
        log_action(user=request.user, action="USER_DISABLED", request=request, target=user)
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def enable(self, request, pk=None):
        user = self.get_object()
        user.is_active = True
        user.save(update_fields=["is_active"])
        log_action(user=request.user, action="USER_ENABLED", request=request, target=user)
        return Response(UserSerializer(user).data)

    def perform_destroy(self, instance):
        # A real, hard delete — not just deactivation — so it needs
        # guardrails a "disable" doesn't: you can't delete your own
        # account (avoids an admin locking themselves out mid-session),
        # and the system can never be left with zero Super Admins able
        # to manage it.
        if instance.id == self.request.user.id:
            raise ValidationError("You can't delete your own account.")

        if instance.role == Role.SUPER_ADMIN or instance.is_superuser:
            remaining = User.objects.filter(role=Role.SUPER_ADMIN).exclude(id=instance.id).count()
            if remaining == 0:
                raise ValidationError("Can't delete the last Super Admin — the system needs at least one.")

        # Capture identity in the log now — after deletion, AuditLog.user
        # becomes null (SET_NULL) same as every other user reference in
        # this schema, so the metadata is the only permanent record of
        # who this actually was.
        log_action(
            user=self.request.user, action="USER_DELETED", request=self.request, target=instance,
            metadata={"deleted_email": instance.email, "deleted_role": instance.role},
        )
        instance.delete()
