import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(dotenv_path=BASE_DIR / '.env')

def env(key, default=None):
    return os.getenv(key, default)


def env_bool(key, default="0"):
    return env(key, default).lower() in ("1", "true", "yes")


def env_list(key, default=""):
    return [v.strip() for v in env(key, default).split(",") if v.strip()]


SECRET_KEY = env("DJANGO_SECRET_KEY", "insecure-dev-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", "0")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "channels",
    # local
    "apps.accounts",
    "apps.organizations",
    "apps.catalog",
    "apps.billing",
    "apps.access",
    "apps.learning",
    "apps.assessments",
    "apps.notifications",
    "apps.platform_config",
    "apps.support",
    "apps.adminpanel",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB", "itdigitech"),
        "USER": env("POSTGRES_USER", "itdigitech"),
        "PASSWORD": env("POSTGRES_PASSWORD", "itdigitech"),
        "HOST": env("POSTGRES_HOST", "localhost"),
        "PORT": env("POSTGRES_PORT", "5432"),
        "CONN_MAX_AGE": 60,
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REDIS_URL = env("REDIS_URL", "redis://127.0.0.1:6379/0")

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}

# ---- DRF / JWT -----------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "2000/hour",
        "auth": "20/minute",
        "ai": "30/hour",
        "code_run": "60/hour",
        "password_reset": "10/hour",
        "support": "60/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=10),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth/"
REFRESH_COOKIE_SECURE = not DEBUG
REFRESH_COOKIE_SAMESITE = "Lax"

SPECTACULAR_SETTINGS = {
    "TITLE": "IT DigiTech Learning Platform API",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:5173")
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# ---- Celery --------------------------------------------------------------
# RabbitMQ sends tasks to Celery workers
CELERY_BROKER_URL = env(
    "CELERY_BROKER_URL",
    "amqp://guest:guest@localhost:5672//",
)

# Redis stores task results
CELERY_RESULT_BACKEND = env(
    "CELERY_RESULT_BACKEND",
    "redis://127.0.0.1:6379/1",
)
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_DEFAULT_QUEUE = "default"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_ROUTES = {
    "apps.billing.tasks.*": {"queue": "critical"},
    "apps.assessments.tasks.*": {"queue": "default"},
    "apps.notifications.tasks.send_templated_email": {"queue": "critical"},
    "apps.notifications.tasks.generate_export": {"queue": "reports"},
    "apps.notifications.tasks.*": {"queue": "default"},
    "apps.support.tasks.*": {"queue": "default"},
}
CELERY_BEAT_SCHEDULE = {
    "reconcile-pending-orders": {
        "task": "apps.billing.tasks.reconcile_pending_orders",
        "schedule": 600.0,
    },
    "auto-submit-expired-attempts": {
        "task": "apps.assessments.tasks.auto_submit_expired_attempts",
        "schedule": 60.0,
    },
    "expire-enrollments": {
        "task": "apps.access.tasks.expire_enrollments",
        "schedule": 3600.0,
    },
    "auto-close-resolved-tickets": {
        "task": "apps.support.tasks.auto_close_resolved_tickets",
        "schedule": 3600.0,
    },
    "purge-old-notifications": {
        "task": "apps.notifications.tasks.purge_old_notifications",
        "schedule": 86400.0,
    },
}

# ---- Channels ------------------------------------------------------------
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# ---- Razorpay ------------------------------------------------------------
# Never hard-code keys. Set them in backend/.env (see .env.example).
RAZORPAY_KEY_ID = env("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = env("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = env("RAZORPAY_WEBHOOK_SECRET", "")
PENDING_ORDER_MIN_AGE_MINUTES = 15

# ---- Video delivery (Bunny-style token auth; adapt to your provider) -----
VIDEO_CDN_HOST = env("VIDEO_CDN_HOST", "")
VIDEO_TOKEN_KEY = env("VIDEO_TOKEN_KEY", "")
VIDEO_URL_TTL_SECONDS = 4 * 3600
BUNNY_LIBRARY_ID = env("BUNNY_LIBRARY_ID", "")

# ---- Email (sent by Celery workers) --------------------------------------
# Dev default prints emails to the worker console. For real delivery set
# EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend and the EMAIL_* values.
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = int(env("EMAIL_PORT", "587"))
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", "1")
EMAIL_TIMEOUT = 20
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "IT DigiTech <noreply@itdigitech.example>")

SITE_NAME = "IT DigiTech Learn"
SUPPORT_EMAIL = env("SUPPORT_EMAIL", "support@itdigitech.example")
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:5173").rstrip("/")
PASSWORD_RESET_TIMEOUT = 60 * 60  # reset links stay valid for 1 hour
EMAIL_VERIFY_MAX_AGE = 60 * 60 * 72  # verification links stay valid for 3 days
SUPPORT_AUTO_CLOSE_DAYS = 3
SUPPORT_MAX_UPLOAD_MB = 5
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
