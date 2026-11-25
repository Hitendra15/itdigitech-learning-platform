from django.contrib import admin

from .models import FeatureFlag, SiteSetting

admin.site.register(FeatureFlag)
admin.site.register(SiteSetting)
