import json

from channels.generic.websocket import AsyncJsonWebsocketConsumer


class InboxConsumer(AsyncJsonWebsocketConsumer):
    """
    One socket per logged-in agent. Joins:
      - `inbox_broadcast`   — all conversation/message events (client filters)
      - `agent_<user_id>`   — events targeted at this agent (assignments, mentions)
    A specific conversation room (`conversation_<id>`) is joined on demand
    when the agent opens that conversation, to avoid every client
    receiving every single message body.
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

    async def receive_json(self, content, **kwargs):
        action = content.get("action")
        conversation_id = content.get("conversation_id")
        if not conversation_id:
            return

        group = f"conversation_{conversation_id}"
        if action == "join_conversation":
            await self.channel_layer.group_add(group, self.channel_name)
            self.groups_joined.append(group)
        elif action == "leave_conversation" and group in self.groups_joined:
            await self.channel_layer.group_discard(group, self.channel_name)
            self.groups_joined.remove(group)

    async def conversation_event(self, event):
        await self.send_json(event)
