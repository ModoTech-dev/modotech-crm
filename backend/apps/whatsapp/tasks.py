"""
Background processing for inbound WhatsApp webhook payloads. The webhook
view only validates + enqueues (spec section 4 / 36) — everything that
touches the database or Meta's media API happens here, retried on
failure instead of dropping the event.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone as dt_timezone

from celery import shared_task
from django.db import transaction

logger = logging.getLogger("apps.whatsapp")


@shared_task(bind=True, max_retries=5, default_retry_delay=10)
def process_webhook_event(self, payload: dict):
    try:
        entries = payload.get("entry", [])
        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})
                _process_messages(value)
                _process_message_echoes(value)
                _process_statuses(value)
    except Exception as exc:  # noqa: BLE001 — must retry, not swallow
        logger.exception("Failed to process WhatsApp webhook payload")
        raise self.retry(exc=exc)


def _process_messages(value: dict):
    from apps.conversations.models import Conversation, ConversationStatus, Message, SenderType
    from apps.conversations.services.realtime import push_new_message, push_conversation_update
    from apps.conversations.services.routing import pick_agent, route_department
    from apps.customers.models import Customer
    from apps.whatsapp.services.meta_client import get_whatsapp_client
    from apps.integrations.services.storage import save_media
    from datetime import timedelta
    from django.conf import settings
    from django.utils import timezone

    contacts = {c["wa_id"]: c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}
    business_number = value.get("metadata", {}).get("display_phone_number", "")

    for msg in value.get("messages", []):
        wa_id = msg["from"]
        msg_type = msg["type"].upper()
        content = _extract_text(msg)
        msg_timestamp = datetime.fromtimestamp(int(msg["timestamp"]), tz=dt_timezone.utc)

        # WhatsApp Coexistence syncs prior chat history into the API side
        # when a number is first connected — genuinely useful for keeping
        # the phone app's own context, but it means old, pre-CRM messages
        # can arrive through this same webhook as if they were new. A
        # configured cutoff (WHATSAPP_HISTORY_CUTOFF_DATE) skips anything
        # from before go-live, so historical noise never enters the CRM.
        cutoff = getattr(settings, "WHATSAPP_HISTORY_CUTOFF", None)
        if cutoff and msg_timestamp < cutoff:
            logger.info("Skipping pre-cutoff message %s (%s, before %s)", msg["id"], msg_timestamp, cutoff)
            continue

        with transaction.atomic():
            # Idempotency: whatsapp_message_id is unique — skip duplicates
            # from Meta's at-least-once webhook delivery.
            from apps.conversations.models import Message as MessageModel
            if MessageModel.objects.filter(whatsapp_message_id=msg["id"]).exists():
                continue

            customer, created = Customer.objects.get_or_create(
                whatsapp_number=wa_id,
                defaults={"name": contacts.get(wa_id, ""), "status": "LEAD"},
            )
            customer.last_contact_at = timezone.now()
            customer.save(update_fields=["last_contact_at"])

            conversation = (
                Conversation.objects.filter(customer=customer)
                .exclude(status=ConversationStatus.CLOSED)
                .order_by("-last_message_at")
                .first()
            )
            is_new_conversation = conversation is None
            if is_new_conversation:
                department = route_department(content)
                conversation = Conversation.objects.create(customer=customer, department=department)
                agent = pick_agent(department)
                if agent:
                    conversation.assigned_agent = agent

            conversation.last_message_at = timezone.now()
            conversation.unread_count = conversation.unread_count + 1
            # WhatsApp's 24h customer service window resets on every inbound message.
            conversation.service_window_expires_at = timezone.now() + timedelta(hours=24)
            conversation.save()

            media_path = ""
            mime_type = ""
            if msg_type in {"IMAGE", "DOCUMENT", "AUDIO", "VIDEO"}:
                media_id = msg.get(msg_type.lower(), {}).get("id")
                if media_id:
                    try:
                        raw_bytes, mime_type = get_whatsapp_client().download_media(media_id)
                        media_path = save_media(_media_filename(msg, msg_type, msg['id']), raw_bytes)
                    except Exception:
                        logger.exception("Failed to download WhatsApp media %s", media_id)

            # A customer sharing their own location gets the same
            # structured treatment as an agent-sent one — coordinates in
            # metadata so the UI can render an actual map link, not just
            # flattened lat/lng text.
            location_metadata = {}
            if msg_type == "LOCATION":
                loc = msg.get("location", {})
                location_metadata = {
                    "latitude": loc.get("latitude"),
                    "longitude": loc.get("longitude"),
                    "name": loc.get("name", ""),
                    "address": loc.get("address", ""),
                }

            # Detected from real webhook payloads, not officially
            # documented by Meta: a reply to one of your WhatsApp Status
            # updates arrives with context.from set to your own business
            # number but — unlike a reply to an actual message — WITHOUT
            # a context.id, since a Status isn't a regular message with
            # its own id in that system. A reply to a specific message
            # always includes both fields; this is how the two are told
            # apart. Surfacing this matters commercially: a customer
            # reaching out because a Status caught their interest is a
            # meaningfully different, often higher-intent conversation
            # than someone messaging cold.
            context = msg.get("context", {})
            replied_to_status = bool(business_number) and context.get("from") == business_number and "id" not in context
            if replied_to_status:
                location_metadata["replied_to_status"] = True

            message = Message.objects.create(
                conversation=conversation,
                sender_type=SenderType.CUSTOMER,
                whatsapp_message_id=msg["id"],
                message_type=msg_type if msg_type in dict(Message._meta.get_field("message_type").choices) else "TEXT",
                content=content,
                media_path=media_path,
                media_mime_type=mime_type,
                metadata=location_metadata,
                status="RECEIVED",
                timestamp=msg_timestamp,
            )

        push_new_message(conversation, message)
        push_conversation_update(conversation, event="conversation_created" if is_new_conversation else "conversation_updated")


def _process_message_echoes(value: dict):
    """
    Handles the smb_message_echoes Coexistence webhook — messages sent
    directly from the phone's WhatsApp Business App by whoever physically
    holds it, bypassing the CRM entirely. Without this, an agent opening
    a conversation has no idea a reply already went out from the phone,
    and might duplicate it or miss context. This is a genuinely different
    payload shape from the normal inbound webhook (value.message_echoes,
    not value.messages — and from/to are reversed: `from` is the
    business's own number here, `to` is the customer), confirmed against
    Meta's own webhook reference and cross-checked against a second
    independent source before writing this.

    Unlike a customer message: this does NOT increment unread_count
    (nothing needs an agent's attention — it's the business side that
    just spoke), and does NOT touch service_window_expires_at — per
    Meta's own docs, messages sent from the Business App don't affect
    the Cloud API's 24h conversation window at all.
    """
    from apps.conversations.models import Conversation, ConversationStatus, Message, SenderType
    from apps.conversations.services.realtime import push_new_message, push_conversation_update
    from apps.conversations.services.routing import pick_agent, route_department
    from apps.customers.models import Customer
    from apps.whatsapp.services.meta_client import get_whatsapp_client
    from apps.integrations.services.storage import save_media
    from django.utils import timezone

    for echo in value.get("message_echoes", []):
        customer_number = echo["to"]  # reversed vs. a normal inbound message
        msg_type = echo["type"].upper()
        content = _extract_text(echo)
        msg_timestamp = datetime.fromtimestamp(int(echo["timestamp"]), tz=dt_timezone.utc)

        with transaction.atomic():
            if Message.objects.filter(whatsapp_message_id=echo["id"]).exists():
                continue

            customer, created = Customer.objects.get_or_create(
                whatsapp_number=customer_number, defaults={"status": "LEAD"},
            )
            customer.last_contact_at = timezone.now()
            customer.save(update_fields=["last_contact_at"])

            conversation = (
                Conversation.objects.filter(customer=customer)
                .exclude(status=ConversationStatus.CLOSED)
                .order_by("-last_message_at")
                .first()
            )
            is_new_conversation = conversation is None
            if is_new_conversation:
                department = route_department(content)
                conversation = Conversation.objects.create(customer=customer, department=department)
                agent = pick_agent(department)
                if agent:
                    conversation.assigned_agent = agent

            conversation.last_message_at = msg_timestamp
            conversation.save()

            media_path = ""
            mime_type = ""
            if msg_type in {"IMAGE", "DOCUMENT", "AUDIO", "VIDEO"}:
                media_id = echo.get(msg_type.lower(), {}).get("id")
                if media_id:
                    try:
                        raw_bytes, mime_type = get_whatsapp_client().download_media(media_id)
                        media_path = save_media(_media_filename(echo, msg_type, echo['id']), raw_bytes)
                    except Exception:
                        logger.exception("Failed to download WhatsApp media %s (phone echo)", media_id)

            location_metadata = {}
            if msg_type == "LOCATION":
                loc = echo.get("location", {})
                location_metadata = {
                    "latitude": loc.get("latitude"),
                    "longitude": loc.get("longitude"),
                    "name": loc.get("name", ""),
                    "address": loc.get("address", ""),
                }

            message = Message.objects.create(
                conversation=conversation,
                sender_type=SenderType.PHONE,
                whatsapp_message_id=echo["id"],
                message_type=msg_type if msg_type in dict(Message._meta.get_field("message_type").choices) else "TEXT",
                content=content,
                media_path=media_path,
                media_mime_type=mime_type,
                metadata=location_metadata,
                status="SENT",
                timestamp=msg_timestamp,
            )

        push_new_message(conversation, message)
        push_conversation_update(conversation, event="conversation_created" if is_new_conversation else "conversation_updated")


def _sanitize_filename_component(value: str) -> str:
    """
    WhatsApp message IDs are base64-encoded and can contain '=', '/',
    '+' — harmless inside a JSON payload, but '=' specifically breaks
    once it ends up sitting in a URL PATH rather than a query string
    (where it's normal and expected). A customer's own filename could,
    in principle, carry unusual characters too. Replacing anything
    that isn't alphanumeric/dot/hyphen/underscore keeps the result
    safe as both a filesystem name and a URL path segment.
    """
    return re.sub(r"[^A-Za-z0-9._-]", "_", value)


def _media_filename(payload: dict, msg_type: str, fallback_id: str) -> str:
    """
    Preserves the ORIGINAL filename (with its real extension) for
    documents specifically — without this, a shared PDF got saved with
    no extension at all, meaning a browser had no way to recognize it
    as a PDF when actually trying to open the download.
    """
    safe_id = _sanitize_filename_component(fallback_id)
    if msg_type == "DOCUMENT":
        original_name = payload.get("document", {}).get("filename")
        if original_name:
            return f"{safe_id}_{_sanitize_filename_component(original_name)}"
    return safe_id


def _extract_text(msg: dict) -> str:
    msg_type = msg["type"]
    if msg_type == "text":
        return msg["text"]["body"]
    if msg_type == "interactive":
        interactive = msg["interactive"]
        return interactive.get("button_reply", interactive.get("list_reply", {})).get("title", "")
    if msg_type == "location":
        loc = msg["location"]
        return loc.get("name") or "Shared a location"
    if msg_type == "document":
        # Most documents arrive with no caption at all — a bare PDF, no
        # typed message alongside it. Falling back to "" here (as the
        # generic path below does) meant agents saw nothing meaningful
        # and the actual saved file had no real name either. filename
        # is the one field WhatsApp always sends for a document, so use
        # it whenever there's no caption to show instead.
        document = msg["document"]
        return document.get("caption") or document.get("filename") or "Shared a document"
    return msg.get(msg_type, {}).get("caption", "") or ""


def _process_statuses(value: dict):
    from apps.conversations.models import Message

    for status_update in value.get("statuses", []):
        Message.objects.filter(whatsapp_message_id=status_update["id"]).update(
            status=status_update["status"].upper()
        )
