import logging

from django.conf import settings

log = logging.getLogger(__name__)


def _links(path):
    return f"{settings.FRONTEND_URL}{path}"


def queue_email(template, subject, to, context=None):
    """Queue an HTML email on Celery. Falls back to sending inline if the broker is down,
    so sign-up and password reset never fail just because Redis is unavailable."""
    from .tasks import send_templated_email

    context = {**(context or {})}
    try:
        send_templated_email.delay(template, subject, to, context)
    except Exception:
        log.exception("Celery broker unavailable; sending %s inline", template)
        send_templated_email.apply(args=(template, subject, to, context))


def dispatch(task, *args):
    """Run any Celery task in the background; run it inline only if the broker is unreachable."""
    try:
        return task.delay(*args)
    except Exception:
        log.exception("Celery broker unavailable; running %s inline", task.name)
        return task.apply(args=args)


def display_name(user):
    profile = getattr(user, "profile", None)
    return (profile.full_name if profile and profile.full_name else user.email.split("@")[0]).split(" ")[0]


# ---- Ready-made emails -------------------------------------------------------
def send_welcome_and_verify(user, token):
    queue_email(
        "welcome_verify", "Welcome to IT DigiTech. Please confirm your email", user.email,
        {"name": display_name(user), "verify_url": _links(f"/verify-email?token={token}")},
    )


def send_verify(user, token):
    queue_email(
        "verify_email", "Confirm your email address", user.email,
        {"name": display_name(user), "verify_url": _links(f"/verify-email?token={token}")},
    )


def send_password_reset(user, uid, token):
    queue_email(
        "password_reset", "Reset your IT DigiTech password", user.email,
        {"name": display_name(user), "reset_url": _links(f"/reset-password?uid={uid}&token={token}"),
         "valid_minutes": settings.PASSWORD_RESET_TIMEOUT // 60},
    )


def send_password_changed(user):
    queue_email(
        "password_changed", "Your password was changed", user.email,
        {"name": display_name(user), "support_email": settings.SUPPORT_EMAIL,
         "reset_url": _links("/forgot-password")},
    )
