from django.core.management.base import BaseCommand

from apps.website import services


class Command(BaseCommand):
    help = "Create the default homepage sections. Safe to run again: it does nothing if sections already exist."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete every homepage section and start again from the defaults.")

    def handle(self, *args, **opts):
        n = services.seed_sections(reset=opts["reset"])
        self.stdout.write(self.style.SUCCESS(f"Created {n} homepage sections.") if n else "Homepage sections already exist; nothing changed.")
