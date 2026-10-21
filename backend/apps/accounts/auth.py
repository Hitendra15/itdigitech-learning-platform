from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import EmailTokenSerializer


def tokens_for_user(user):
    refresh = EmailTokenSerializer.get_token(user)
    return str(refresh.access_token), str(refresh)


def set_refresh_cookie(response, refresh):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        refresh,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(settings.REFRESH_COOKIE_NAME, path=settings.REFRESH_COOKIE_PATH)
    return response


def blacklist(refresh_str):
    try:
        RefreshToken(refresh_str).blacklist()
    except Exception:
        pass


def revoke_all_sessions(user):
    """Blacklist every outstanding refresh token so other devices are signed out."""
    from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
