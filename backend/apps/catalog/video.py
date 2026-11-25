"""Signed playback URL. Implements Bunny-style token auth; swap for Mux / CloudFront as needed."""
import base64
import hashlib
import time

from django.conf import settings


def signed_playback_url(path: str) -> str:
    expires = int(time.time()) + settings.VIDEO_URL_TTL_SECONDS
    raw = f"{settings.VIDEO_TOKEN_KEY}{path}{expires}".encode()
    token = base64.b64encode(hashlib.sha256(raw).digest()).decode()
    token = token.replace("\n", "").replace("+", "-").replace("/", "_").replace("=", "")
    return f"{settings.VIDEO_CDN_HOST}{path}?token={token}&expires={expires}"
