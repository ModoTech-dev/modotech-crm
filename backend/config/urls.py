from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    # apps.accounts.urls itself nests "auth/" (login/logout/refresh/me)
    # and "" (the /users/ router), so this one include gives us both
    # /api/auth/... and /api/users/...
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.customers.urls")),       # /api/customers/, /api/tags/
    path("api/", include("apps.conversations.urls")),   # /api/conversations/
    path("api/whatsapp/", include("apps.whatsapp.urls")),
    path("api/reports/", include("apps.reports.urls")),
    path("api/audit-logs/", include("apps.integrations.urls")),
    path("api/automation/", include("apps.automation.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
