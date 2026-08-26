"""
Publishes conversation/message events onto the Django Channels layer so
connected agent dashboards update without a page refresh (spec section 11).
"""
import json

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.renderers import JSONRenderer


def _json_safe(data: dict) -> dict:
    """
    DRF serializer .data still contains raw Python objects (UUID,
    datetime) — those only get converted to strings during JSON
    rendering, not just by accessing .data. channels_redis serializes
    group_send payloads with msgpack, which can't handle a raw UUID at
    all, so this round-trips through DRF's own JSON renderer first to
    guarantee everything downstream is a plain, JSON-safe type. This
    was a real, silent bug — every push failed with a TypeError before
    ever reaching a connected client, unrelated to whether anyone was
    actually listening.
    """
    return json.loads(JSONRenderer().render(data))


def _group_name(conversation_id) -> str:
    return f"conversation_{conversation_id}"


def push_new_message(conversation, message):
    from apps.conversations.serializers import MessageSerializer

    channel_layer = get_channel_layer()
    payload = {
        "type": "conversation.event",
        "event": "new_message",
        "conversation_id": str(conversation.id),
        "message": _json_safe(MessageSerializer(message).data),
    }
    async_to_sync(channel_layer.group_send)(_group_name(conversation.id), payload)
    async_to_sync(channel_layer.group_send)("inbox_broadcast", payload)


def push_conversation_update(conversation, event: str = "conversation_updated"):
    from apps.conversations.serializers import ConversationListSerializer

    channel_layer = get_channel_layer()
    payload = {
        "type": "conversation.event",
        "event": event,
        "conversation_id": str(conversation.id),
        "conversation": _json_safe(ConversationListSerializer(conversation).data),
    }
    async_to_sync(channel_layer.group_send)(_group_name(conversation.id), payload)
    async_to_sync(channel_layer.group_send)("inbox_broadcast", payload)


def notify_agent(agent_id, notification: dict):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"agent_{agent_id}",
        {"type": "conversation.event", "event": "notification", **_json_safe(notification)},
    )
