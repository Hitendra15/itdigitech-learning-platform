"""Token helpers for password reset and email verification."""
from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from .models import User

VERIFY_SALT = "itdigitech.email-verify"


def make_reset_token(user):
    """uid + token. The token embeds the password hash and last_login, so it stops
    working the moment the password changes: every link is single-use."""
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


def user_from_reset(uid, token):
    try:
        user = User.objects.get(pk=force_str(urlsafe_base64_decode(uid)), is_active=True)
    except (User.DoesNotExist, ValueError, TypeError, OverflowError):
        return None
    return user if default_token_generator.check_token(user, token) else None


def make_verify_token(user):
    return signing.dumps({"uid": user.pk, "email": user.email}, salt=VERIFY_SALT)


def user_from_verify(token):
    try:
        data = signing.loads(token, salt=VERIFY_SALT, max_age=settings.EMAIL_VERIFY_MAX_AGE)
    except signing.BadSignature:
        return None
    # Reject links for an address the user has since changed.
    return User.objects.filter(pk=data["uid"], email=data["email"]).first()
