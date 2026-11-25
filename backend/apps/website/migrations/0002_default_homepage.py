from django.db import migrations


def seed(apps, schema_editor):
    """Give a fresh install a complete, editable homepage. Existing homepages are never touched."""
    from apps.website.defaults import DEFAULT_SECTIONS

    HomeSection = apps.get_model("website", "HomeSection")
    if HomeSection.objects.exists():
        return
    for i, (section_type, label, enabled, content) in enumerate(DEFAULT_SECTIONS, start=1):
        HomeSection.objects.create(section_type=section_type, label=label, order=i * 10, is_enabled=enabled, content=content)


class Migration(migrations.Migration):
    dependencies = [("website", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
