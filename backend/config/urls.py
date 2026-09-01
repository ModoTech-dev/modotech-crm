from django.contrib import admin
from django.conf import settings
from django.urls import path, include, re_path
from django.views.static import serve

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

# Deliberately NOT using django.conf.urls.static.static() here — that
# helper has DEBUG=False baked into it internally (`elif not
# settings.DEBUG: return []`), so it silently registers nothing in
# production no matter how it's called from this file. That was the
# actual, complete bug: every WhatsApp attachment 404'd because there
# was truly no route at all outside local development. Building the
# pattern directly against the same underlying view sidesteps that.
#
# Django's own docs steer toward having a real web server serve media
# directly in production for better performance — a reasonable ideal,
# but this app's nginx currently proxies /media/ to Django rather than
# reading the volume directly, and at this app's actual traffic scale,
# Django serving these files itself is a pragmatic, low-risk choice.
urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
