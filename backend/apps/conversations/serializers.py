from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.customers.serializers import CustomerSerializer, TagSerializer
from .models import Conversation, ConversationAssignment, InternalMessage, InternalNote, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_user_name = serializers.CharField(source="sender_user.get_full_name", read_only=True, default=None)
    media_url = serializers.SerializerMethodField()
    deleted_by_name = serializers.CharField(source="deleted_by.get_full_name", read_only=True, default=None)

    class Meta:
        model = Message
        fields = [
            "id", "conversation", "sender_type", "sender_user", "sender_user_name",
            "whatsapp_message_id", "message_type", "content", "media_path", "media_url",
            "media_mime_type", "status", "timestamp", "metadata", "created_at",
            "is_deleted", "deleted_at", "deleted_by_name",
        ]
        read_only_fields = ["id", "whatsapp_message_id", "status", "created_at", "media_url", "is_deleted", "deleted_at"]

    def get_media_url(self, obj):
        if not obj.media_path or obj.is_deleted:
            return None
        from apps.integrations.services.storage import media_url
        return media_url(obj.media_path)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.is_deleted:
            # Mirrors WhatsApp's own "This message was deleted" convention
            # — the content itself stays in the database for audit
            # purposes, it just isn't served to the frontend once deleted.
            data["content"] = ""
        return data


class InternalMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.get_full_name", read_only=True, default=None)
    recipient_name = serializers.CharField(source="recipient.get_full_name", read_only=True, default=None)
    # Deliberately minimal, not the full CustomerSerializer — this is a
    # lightweight reference for display in a chat bubble, not a data
    # export. Actually opening the conversation still goes through the
    # normal Customer/Conversation access checks, unaffected by this.
    referenced_customer_name = serializers.CharField(source="referenced_customer.name", read_only=True, default=None)
    referenced_customer_number = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = InternalMessage
        fields = [
            "id", "sender", "sender_name", "recipient", "recipient_name", "content",
            "referenced_customer", "referenced_customer_name", "referenced_customer_number",
            "file_url", "file_name", "file_mime_type",
            "broadcast_id", "created_at", "read_at",
        ]
        read_only_fields = ["id", "sender", "sender_name", "recipient_name", "broadcast_id", "created_at", "read_at", "file_url"]

    def get_referenced_customer_number(self, obj):
        if not obj.referenced_customer_id:
            return None
        from apps.customers.services.phone_masking import visible_number

        return visible_number(obj.referenced_customer.whatsapp_number, self.context.get("request"))

    def get_file_url(self, obj):
        if not obj.file_path:
            return None
        from apps.integrations.services.storage import media_url

        return media_url(obj.file_path)


class InternalNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = InternalNote
        fields = ["id", "conversation", "author", "author_name", "content", "created_at"]
        read_only_fields = ["id", "author", "created_at"]

    def get_author_name(self, obj):
        # author can be None if that account was later deleted — the note
        # itself is preserved (see InternalNote.author's SET_NULL), so
        # this needs a graceful fallback rather than crashing.
        if obj.author is None:
            return "Deleted user"
        return obj.author.get_full_name() or obj.author.email


class ConversationAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConversationAssignment
        fields = ["id", "conversation", "previous_agent", "new_agent", "assigned_by", "reason", "created_at"]
        read_only_fields = fields


class ConversationListSerializer(serializers.ModelSerializer):
    """Lightweight shape for the left-hand conversation list."""

    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_whatsapp_number = serializers.SerializerMethodField()
    customer_whatsapp_number_masked = serializers.SerializerMethodField()
    assigned_agent_name = serializers.CharField(source="assigned_agent.get_full_name", read_only=True, default=None)
    last_message_preview = serializers.SerializerMethodField()
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id", "customer", "customer_name", "customer_whatsapp_number", "customer_whatsapp_number_masked",
            "assigned_agent", "assigned_agent_name", "department", "status",
            "priority", "tags", "last_message_at", "last_message_preview", "unread_count",
        ]

    def get_customer_whatsapp_number(self, obj):
        from apps.customers.services.phone_masking import visible_number

        return visible_number(obj.customer.whatsapp_number, self.context.get("request"))

    def get_customer_whatsapp_number_masked(self, obj):
        from apps.customers.services.phone_masking import user_can_see_full_number

        request = self.context.get("request")
        return not user_can_see_full_number(getattr(request, "user", None))

    def get_last_message_preview(self, obj):
        last = obj.messages.order_by("-timestamp").first()
        if not last:
            return ""
        return last.content[:120]


class ConversationDetailSerializer(serializers.ModelSerializer):
    customer = CustomerSerializer(read_only=True)
    assigned_agent = UserSerializer(read_only=True)
    tags = TagSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = [
            "id", "customer", "assigned_agent", "department", "status", "priority",
            "subject", "tags", "last_message_at", "unread_count",
            "service_window_expires_at", "created_at", "updated_at",
        ]


class AssignConversationSerializer(serializers.Serializer):
    agent_id = serializers.UUIDField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")


class SendMessageSerializer(serializers.Serializer):
    message_type = serializers.ChoiceField(
        choices=["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "TEMPLATE", "LOCATION"], default="TEXT"
    )
    content = serializers.CharField(required=False, allow_blank=True, default="")
    template_name = serializers.CharField(required=False, allow_blank=True, default="")
    template_variables = serializers.DictField(required=False, default=dict)
    media_path = serializers.CharField(required=False, allow_blank=True, default="")
    latitude = serializers.FloatField(required=False, allow_null=True, default=None)
    longitude = serializers.FloatField(required=False, allow_null=True, default=None)
    location_name = serializers.CharField(required=False, allow_blank=True, default="")
    location_address = serializers.CharField(required=False, allow_blank=True, default="")
