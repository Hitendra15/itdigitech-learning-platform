import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("itdigitech")
app.config_from_object("django.conf:settings", namespace="CELERY")
# Redis SSL configuration for Upstash
app.conf.update(
    broker_use_ssl={
        "ssl_cert_reqs": "CERT_REQUIRED",
    },
    redis_backend_use_ssl={
        "ssl_cert_reqs": "CERT_REQUIRED",
    },
)
app.autodiscover_tasks()
