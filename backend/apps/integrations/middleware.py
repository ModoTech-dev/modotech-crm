"""
Lightweight audit middleware: logs authenticated, state-changing API
calls (POST/PUT/PATCH/DELETE) that weren't already logged explicitly
by a view. This is a safety net, not the primary audit mechanism —
sensitive actions (login, assignment, user changes) call log_action()
directly with richer metadata.
"""
from apps.integrations.services.audit import log_action

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
SKIP_PATH_PREFIXES = ("/api/auth/", "/api/whatsapp/webhook")


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if (
            request.method in WRITE_METHODS
            and request.path.startswith("/api/")
            and not request.path.startswith(SKIP_PATH_PREFIXES)
            and getattr(request, "user", None)
            and request.user.is_authenticated
            and 200 <= response.status_code < 300
        ):
            log_action(
                user=request.user,
                action=f"{request.method} {request.path}",
                request=request,
                metadata={"status_code": response.status_code},
            )

        return response
