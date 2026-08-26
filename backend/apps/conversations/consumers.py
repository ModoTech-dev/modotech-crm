import json

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache


def _viewers_key(conversation_id) -> str:
    return f"conversation_viewers:{conversation_id}"


class InboxConsumer(AsyncJsonWebsocketConsumer):
    """
    One socket per logged-in agent. Joins:
      - `inbox_broadcast`   — all conversation/message events (client filters)
      - `agent_<user_id>`   — events targeted at this agent (assignments, mentions)
    A specific conversation room (`conversation_<id>`) is joined on demand
    when the agent opens that conversation, to avoid every client
    receiving every single message body.

    Also tracks WHO is currently viewing each conversation, so a shared
    inbox can warn an agent "someone's already here" before they start
    asking the customer questions a colleague already covered a moment
    ago. Viewer lists live in cache (not just in-process memory) since
    Channels workers can be multiple separate processes — one worker
    handling a join has to be visible to another worker handling a
    concurrent leave for the same conversation.
    """

    async def connect(self):
        user = self.scope["user"]
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.user = user
        self.groups_joined = ["inbox_broadcast", f"agent_{user.id}"]
        for group in self.groups_joined:
            await self.channel_layer.group_add(group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        for group in getattr(self, "groups_joined", []):
            await self.channel_layer.group_discard(group, self.channel_name)
        # Clean up presence for every conversation room this connection
        # was viewing — closing the tab or losing connection should
        # remove the "currently viewing" banner for everyone else just
        # as reliably as an explicit leave_conversation would.
        for group in list(getattr(self, "groups_joined", [])):
            if group.startswith("conversation_"):
                await self._leave_conversation(group.removeprefix("conversation_"))

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        conversation_id = content.get("conversation_id")
        if not conversation_id:
            return

        group = f"conversation_{conversation_id}"
        if action == "join_conversation":
            await self.channel_layer.group_add(group, self.channel_name)
            self.groups_joined.append(group)
            await self._join_conversation(conversation_id)
        elif action == "leave_conversation" and group in self.groups_joined:
            await self.channel_layer.group_discard(group, self.channel_name)
            self.groups_joined.remove(group)
            await self._leave_conversation(conversation_id)

    async def _join_conversation(self, conversation_id):
        viewers = await sync_to_async(cache.get)(_viewers_key(conversation_id), {})
        viewers[self.channel_name] = {"user_id": str(self.user.id), "name": self.user.get_full_name() or self.user.email}
        await sync_to_async(cache.set)(_viewers_key(conversation_id), viewers, 3600)
        await self._broadcast_viewers(conversation_id, viewers)

    async def _leave_conversation(self, conversation_id):
        viewers = await sync_to_async(cache.get)(_viewers_key(conversation_id), {})
        viewers.pop(self.channel_name, None)
        if viewers:
            await sync_to_async(cache.set)(_viewers_key(conversation_id), viewers, 3600)
        else:
            await sync_to_async(cache.delete)(_viewers_key(conversation_id))
        await self._broadcast_viewers(conversation_id, viewers)

    async def _broadcast_viewers(self, conversation_id, viewers: dict):
        # Deduped by user_id — the same agent with two tabs open on the
        # same conversation should show up once, not twice.
        unique = list({v["user_id"]: v for v in viewers.values()}.values())
        await self.channel_layer.group_send(
            f"conversation_{conversation_id}",
            {
                "type": "conversation.event",
                "event": "conversation_viewers",
                "conversation_id": str(conversation_id),
                "viewers": unique,
            },
        )

    async def conversation_event(self, event):
        await self.send_json(event)
