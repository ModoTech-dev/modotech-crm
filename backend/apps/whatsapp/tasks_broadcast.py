"""
Broadcast sending. Kept in its own module (rather than tasks.py, which
handles inbound webhook processing) since outbound bulk sends have a
different failure/retry shape — one failed recipient shouldn't fail the
whole broadcast or get silently retried into a duplicate send.
"""
from __future__ import annotations

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger("apps.whatsapp")


@shared_task(bind=True)
def send_broadcast(self, broadcast_id: str):
    from apps.conversations.models import Conversation, Message, SenderType
    from apps.customers.models import Customer
    from apps.whatsapp.models import Broadcast, BroadcastRecipient
    from apps.whatsapp.services.meta_client import WhatsAppAPIError, get_whatsapp_client

    try:
        broadcast = Broadcast.objects.select_related("template").get(id=broadcast_id)
    except Broadcast.DoesNotExist:
        logger.error("Broadcast %s not found", broadcast_id)
        return

    if broadcast.template.status != "APPROVED":
        broadcast.status = "FAILED"
        broadcast.error = "Template is not APPROVED by Meta yet — cannot send."
        broadcast.save(update_fields=["status", "error"])
        return

    broadcast.status = "SENDING"
    broadcast.started_at = timezone.now()
    broadcast.save(update_fields=["status", "started_at"])

    customers = _resolve_recipients(broadcast)
    client = get_whatsapp_client()

    sent, failed = 0, 0
    for customer in customers:
        recipient, _ = BroadcastRecipient.objects.get_or_create(broadcast=broadcast, customer=customer)
        try:
            wamid = client.send_message(
                to=customer.whatsapp_number,
                message_type="TEMPLATE",
                template_name=broadcast.template.name,
                template_variables={"customer_name": customer.name or "there"},
            )
            recipient.status = "SENT"
            recipient.whatsapp_message_id = wamid
            recipient.save(update_fields=["status", "whatsapp_message_id"])

            # Log it into that customer's conversation history too, so
            # agents see broadcast messages in context, not just in the
            # broadcast report.
            conversation = Conversation.objects.filter(customer=customer).order_by("-last_message_at").first()
            if conversation:
                Message.objects.create(
                    conversation=conversation,
                    sender_type=SenderType.BOT,
                    whatsapp_message_id=wamid,
                    message_type="TEMPLATE",
                    content=f"[Broadcast: {broadcast.template.name}]",
                    status="SENT",
                    timestamp=timezone.now(),
                )
            sent += 1
        except WhatsAppAPIError as exc:
            recipient.status = "FAILED"
            recipient.error = str(exc)
            recipient.save(update_fields=["status", "error"])
            failed += 1
            logger.warning("Broadcast %s failed for customer %s: %s", broadcast_id, customer.id, exc)

    broadcast.status = "COMPLETED"
    broadcast.completed_at = timezone.now()
    broadcast.sent_count = sent
    broadcast.failed_count = failed
    broadcast.save(update_fields=["status", "completed_at", "sent_count", "failed_count"])


def _resolve_recipients(broadcast):
    from apps.customers.models import Customer

    qs = Customer.objects.all()
    if broadcast.customer_status_filter:
        qs = qs.filter(status=broadcast.customer_status_filter)
    if broadcast.tag_filter_id:
        qs = qs.filter(tags=broadcast.tag_filter_id)
    return qs.distinct()
