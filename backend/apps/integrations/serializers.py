from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None)

    class Meta:
        model = AuditLog
        fields = ["id", "user", "user_email", "action", "object_type", "object_id", "ip_address", "metadata", "created_at"]
        read_only_fields = fields
