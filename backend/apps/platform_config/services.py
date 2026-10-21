from django.core.cache import cache

from .models import FeatureFlag, SiteSetting

_MISSING = object()


def flag_enabled(key, default=False):
    cached = cache.get(f"flag:{key}", _MISSING)
    if cached is _MISSING:
        obj = FeatureFlag.objects.filter(key=key).first()
        cached = obj.enabled if obj else default
        cache.set(f"flag:{key}", cached, 300)
    return cached


def get_setting(key, default=None):
    cached = cache.get(f"setting:{key}", _MISSING)
    if cached is _MISSING:
        obj = SiteSetting.objects.filter(key=key).first()
        cached = obj.value if obj else default
        cache.set(f"setting:{key}", cached, 300)
    return cached
