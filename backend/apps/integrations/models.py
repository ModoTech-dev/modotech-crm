import uuid

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="audit_logs",
    )
    # 100 chars was too tight — the generic "{METHOD} {path}" fallback
    # logged by AuditLogMiddleware can exceed it on deeply-nested URLs
    # (e.g. a path with two UUIDs in it), causing the whole request to
    # fail with a DataError. 255 gives real headroom without needing to
    # think about this again for any reasonable URL shape.
    action = models.CharField(max_length=255)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "-created_at"]),
            models.Index(fields=["object_type", "object_id"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.user} at {self.created_at:%Y-%m-%d %H:%M}"
