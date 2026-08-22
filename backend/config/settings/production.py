from .base import *  # noqa

DEBUG = False

SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=True, cast=bool)  # noqa
# Required whenever Django sits behind a reverse proxy (always true in
# real deployments) — without this, Django can't tell the original
# browser request was HTTPS, since the actual connection it receives
# internally (from nginx) is always plain HTTP. Both our own container's
# nginx and the host-level nginx correctly set X-Forwarded-Proto, so
# this just tells Django to trust and use that header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# In production, media should move to S3/R2/Spaces — see apps/integrations/services/storage.py
