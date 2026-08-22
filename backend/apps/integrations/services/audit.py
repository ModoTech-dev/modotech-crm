"""
Central helper for writing AuditLog entries. Views/services call
log_action(...) instead of touching the model directly, so the audit
trail format stays consistent everywhere.
"""
from __future__ import annotations


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(*, user=None, action: str, request=None, target=None, metadata: dict | None = None):
    from apps.integrations.models import AuditLog

    return AuditLog.objects.create(
        user=user,
        action=action,
        object_type=target.__class__.__name__ if target is not None else "",
        object_id=str(getattr(target, "id", "")) if target is not None else "",
        ip_address=_client_ip(request),
        metadata=metadata or {},
    )
