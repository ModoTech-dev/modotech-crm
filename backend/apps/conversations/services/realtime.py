"""
Publishes conversation/message events onto the Django Channels layer so
connected agent dashboards update without a page refresh (spec section 11).
"""
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer


def _group_name(conversation_id) -> str:
    return f"conversation_{conversation_id}"


def push_new_message(conversation, message):
    from apps.conversations.serializers import MessageSerializer

    channel_layer = get_channel_layer()
    payload = {
        "type": "conversation.event",
        "event": "new_message",
        "conversation_id": str(conversation.id),
        "message": MessageSerializer(message).data,
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
        "conversation": ConversationListSerializer(conversation).data,
    }
    async_to_sync(channel_layer.group_send)(_group_name(conversation.id), payload)
    async_to_sync(channel_layer.group_send)("inbox_broadcast", payload)


def notify_agent(agent_id, notification: dict):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"agent_{agent_id}",
        {"type": "conversation.event", "event": "notification", **notification},
    )
