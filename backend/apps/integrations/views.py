from rest_framework import generics
from apps.accounts.permissions import IsAdminOrAbove
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdminOrAbove]
    filterset_fields = ["action", "object_type", "user"]
