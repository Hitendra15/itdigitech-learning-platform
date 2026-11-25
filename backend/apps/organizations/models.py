from django.db import models

from common.models import BaseModel


class Organization(BaseModel):
    """College / institute. Used from Phase 6; FK is nullable everywhere until then."""

    name = models.CharField(max_length=200)
    org_type = models.CharField(max_length=30, default="college")
    contact_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
