"""
One-time cleanup for message history that WhatsApp Coexistence synced
in from before your actual go-live date. The webhook itself now filters
this going forward (see WHATSAPP_HISTORY_CUTOFF_DATE / tasks.py), but
that doesn't retroactively touch anything already sitting in the
database from the initial sync — this command does that part, once,
under your explicit control.

Usage:
    python manage.py purge_pre_cutoff_messages --before 2026-08-19 --dry-run
    python manage.py purge_pre_cutoff_messages --before 2026-08-19

Scope, deliberately conservative: this only deletes conversations that
are ENTIRELY pre-cutoff (every message in them is older than --before).
A conversation with even one message on or after the cutoff — meaning
there's real, ongoing activity — is left completely untouched, old
messages included, since those provide legitimate context for an active
relationship rather than being pure historical noise.
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from datetime import datetime


class Command(BaseCommand):
    help = "Delete conversations that are entirely pre-cutoff history (WhatsApp Coexistence sync cleanup)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--before", required=True,
            help="Delete conversations whose messages are ALL before this date, format YYYY-MM-DD.",
        )
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Show what would be deleted without actually deleting anything.",
        )

    def handle(self, *args, **options):
        from apps.conversations.models import Conversation
        from apps.customers.models import Customer

        try:
            cutoff_naive = datetime.strptime(options["before"], "%Y-%m-%d")
        except ValueError:
            raise CommandError("--before must be in YYYY-MM-DD format, e.g. 2026-08-19")
        cutoff = timezone.make_aware(cutoff_naive)

        # A conversation is "fully historical" only if it has at least
        # one message (not an empty shell) AND none of its messages are
        # on or after the cutoff.
        fully_historical = [
            c for c in Conversation.objects.prefetch_related("messages")
            if c.messages.exists() and not c.messages.filter(timestamp__gte=cutoff).exists()
        ]
        message_count = sum(c.messages.count() for c in fully_historical)

        affected_customer_ids = {c.customer_id for c in fully_historical}
        fully_historical_ids = {c.id for c in fully_historical}
        customers_to_check = Customer.objects.filter(id__in=affected_customer_ids)
        would_be_empty_customers = [
            cust for cust in customers_to_check
            if not cust.conversations.exclude(id__in=fully_historical_ids).exists()
        ]

        if not fully_historical:
            self.stdout.write(self.style.SUCCESS(f"No fully pre-{cutoff.date()} conversations found. Nothing to do."))
            return

        self.stdout.write(f"Conversations entirely before {cutoff.date()} (no activity on/after it):")
        self.stdout.write(f"  {len(fully_historical)} conversation(s), {message_count} message(s) total, would be deleted")
        self.stdout.write(f"  {len(would_be_empty_customers)} customer(s) would have zero remaining conversations and be removed")
        self.stdout.write(
            "\nConversations with ANY activity on or after the cutoff are not touched at all, "
            "including their older messages — only entirely-historical threads are affected."
        )

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING("\nDry run only — nothing was deleted. Re-run without --dry-run to apply."))
            return

        for conv in fully_historical:
            conv.delete()  # CASCADE removes its messages too
        for cust in would_be_empty_customers:
            cust.delete()

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Removed {len(fully_historical)} fully-historical conversation(s) "
            f"({message_count} message(s)), {len(would_be_empty_customers)} now-empty customer(s)."
        ))
