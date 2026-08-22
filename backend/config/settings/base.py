"""
Base settings shared by all environments.
Environment-specific overrides live in dev.py / production.py.
"""
from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("DJANGO_SECRET_KEY", default="dev-only-insecure-key-change-me")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

AUTH_USER_MODEL = "accounts.User"

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "channels",
    "django_filters",
    # local apps
    "apps.accounts",
    "apps.customers",
    "apps.conversations",
    "apps.whatsapp",
    "apps.reports",
    "apps.automation",
    "apps.integrations",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.integrations.middleware.AuditLogMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("POSTGRES_DB", default="modotech_crm"),
        "USER": config("POSTGRES_USER", default="modotech"),
        "PASSWORD": config("POSTGRES_PASSWORD", default="modotech"),
        "HOST": config("POSTGRES_HOST", default="localhost"),
        "PORT": config("POSTGRES_PORT", default="5432"),
    }
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------------------
# Password validation
# ---------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = config("TIME_ZONE", default="Africa/Nairobi")
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ---------------------------------------------------------------------------
# DRF / JWT
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "whatsapp-webhook": "600/minute",
        "auth": "20/minute",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="http://localhost:5173", cast=Csv())
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------------------
# Channels / Redis
# ---------------------------------------------------------------------------
REDIS_URL = config("REDIS_URL", default="redis://localhost:6379/0")

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default=REDIS_URL)
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default=REDIS_URL)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ALWAYS_EAGER = config("CELERY_TASK_ALWAYS_EAGER", default=False, cast=bool)

# ---------------------------------------------------------------------------
# WhatsApp Cloud API configuration (never hard-code secrets — env only)
# ---------------------------------------------------------------------------
WHATSAPP_ACCESS_TOKEN = config("WHATSAPP_ACCESS_TOKEN", default="")
WHATSAPP_PHONE_NUMBER_ID = config("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_BUSINESS_ACCOUNT_ID = config("WHATSAPP_BUSINESS_ACCOUNT_ID", default="")
WHATSAPP_VERIFY_TOKEN = config("WHATSAPP_VERIFY_TOKEN", default="")
WHATSAPP_APP_SECRET = config("WHATSAPP_APP_SECRET", default="")
WHATSAPP_API_VERSION = config("WHATSAPP_API_VERSION", default="v21.0")
WHATSAPP_GRAPH_BASE_URL = config("WHATSAPP_GRAPH_BASE_URL", default="https://graph.facebook.com")
# "meta" = direct Meta Graph API (Tech Provider route). "360dialog" =
# route outbound sends through 360dialog's own proxy API instead — see
# apps/whatsapp/services/meta_client.py for exactly what this changes.
WHATSAPP_PROVIDER = config("WHATSAPP_PROVIDER", default="meta")
# 360dialog-specific: a separately-generated "Platform Secret" (NOT the
# Meta App Secret above) used to verify the x-360dialog-signature header
# on inbound webhooks. Only relevant when WHATSAPP_PROVIDER=360dialog.
WHATSAPP_WEBHOOK_SECRET = config("WHATSAPP_WEBHOOK_SECRET", default="")
# Deliberate, explicit opt-out of webhook signature verification — see
# the long comment in apps/whatsapp/services/webhook_security.py for
# why this exists and what the real tradeoff is. Only set this to False
# after confirming with 360dialog support that Platform Secret genuinely
# isn't available for your account type. Defaults to True (secure).
WHATSAPP_REQUIRE_WEBHOOK_SIGNATURE = config("WHATSAPP_REQUIRE_WEBHOOK_SIGNATURE", default=True, cast=bool)

# Filters out pre-go-live message history that WhatsApp Coexistence syncs
# in when a number is first connected — see apps/whatsapp/tasks.py for
# why this exists. Format: YYYY-MM-DD. Leave blank to process everything
# (the historical default, and what you want if you're not on Coexistence).
_whatsapp_history_cutoff_date = config("WHATSAPP_HISTORY_CUTOFF_DATE", default="")
if _whatsapp_history_cutoff_date:
    from datetime import datetime as _datetime
    from django.utils import timezone as _tz

    WHATSAPP_HISTORY_CUTOFF = _tz.make_aware(_datetime.strptime(_whatsapp_history_cutoff_date, "%Y-%m-%d"))
else:
    WHATSAPP_HISTORY_CUTOFF = None

FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:5173")

# ---------------------------------------------------------------------------
# ISP integration abstraction — swap the class in production without
# touching any view/service that consumes ISPService.
# ---------------------------------------------------------------------------
ISP_SERVICE_CLASS = config(
    "ISP_SERVICE_CLASS", default="apps.integrations.services.isp.MockISPService"
)

# ---------------------------------------------------------------------------
# AI assistant abstraction (optional in MVP)
# ---------------------------------------------------------------------------
AI_SERVICE_CLASS = config(
    "AI_SERVICE_CLASS", default="apps.integrations.services.ai.NullAIService"
)
AI_API_KEY = config("AI_API_KEY", default="")

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {"format": "[{asctime}] {levelname} {name}: {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "verbose"},
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "apps": {"handlers": ["console"], "level": "DEBUG", "propagate": False},
    },
}
