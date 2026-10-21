from django.core.cache import cache
from django.db import models

from common.models import BaseModel


class FeatureFlag(BaseModel):
    key = models.SlugField(unique=True)
    enabled = models.BooleanField(default=False)
    description = models.CharField(max_length=255, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(f"flag:{self.key}")

    def __str__(self):
        return f"{self.key}={self.enabled}"


class SiteSetting(BaseModel):
    key = models.SlugField(unique=True)
    value = models.JSONField(default=dict)
    description = models.CharField(max_length=255, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        cache.delete(f"setting:{self.key}")

    def __str__(self):
        return self.key
