from rest_framework import serializers
from .models import Customer, Tag


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]


class CustomerSerializer(serializers.ModelSerializer):
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(
        source="tags", queryset=Tag.objects.all(), many=True, write_only=True, required=False
    )
    open_conversation_count = serializers.SerializerMethodField()
    payment_confirmed_by_name = serializers.CharField(
        source="payment_confirmed_by.get_full_name", read_only=True, default=None
    )

    class Meta:
        model = Customer
        fields = [
            "id", "whatsapp_number", "name", "email", "phone", "location",
            "account_number", "isp_customer_id", "status", "lead_outcome", "tags", "tag_ids",
            "notes", "created_at", "updated_at", "last_contact_at",
            "open_conversation_count",
            "payment_receipt_number", "payment_amount", "payment_confirmed_at", "payment_confirmed_by_name",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "last_contact_at", "payment_confirmed_at"]

    def get_open_conversation_count(self, obj):
        return obj.conversations.exclude(status__in=["RESOLVED", "CLOSED"]).count()

    def update(self, instance, validated_data):
        # Who confirmed a payment, and when, is attributed server-side —
        # never trust the frontend to say who it was. Only stamps when a
        # receipt number is actually being newly provided or changed,
        # not on every unrelated save.
        new_receipt = validated_data.get("payment_receipt_number")
        if new_receipt and new_receipt != instance.payment_receipt_number:
            from django.utils import timezone

            instance.payment_confirmed_at = timezone.now()
            request = self.context.get("request")
            if request and getattr(request, "user", None):
                instance.payment_confirmed_by = request.user
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        # whatsapp_number stays a normal writable field above (so
        # creating/editing a customer still works exactly as before) —
        # only the OUTPUT gets masked, based on who's asking. Applied
        # here rather than as a read-only method field specifically so
        # writes aren't affected.
        data = super().to_representation(instance)
        from .services.phone_masking import user_can_see_full_number, visible_number

        request = self.context.get("request")
        data["whatsapp_number"] = visible_number(instance.whatsapp_number, request)
        data["whatsapp_number_masked"] = not user_can_see_full_number(getattr(request, "user", None))
        return data


class ISPAccountSerializer(serializers.Serializer):
    account_number = serializers.CharField()
    package = serializers.CharField()
    speed_mbps = serializers.IntegerField()
    monthly_price = serializers.FloatField()
    status = serializers.CharField()
    balance = serializers.FloatField()
    last_payment_date = serializers.DateField(allow_null=True)
    next_expiry_date = serializers.DateField(allow_null=True)
    installation_date = serializers.DateField(allow_null=True)
    service_location = serializers.CharField()


class StartConversationSerializer(serializers.Serializer):
    """
    Agent-initiated contact: create (or reuse) a Customer by WhatsApp
    number, then kick off a Conversation by sending an approved template
    — the only way to message someone who has never written in first,
    per WhatsApp's own rules.
    """

    whatsapp_number = serializers.CharField()
    name = serializers.CharField(required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    location = serializers.CharField(required=False, allow_blank=True, default="")
    department = serializers.CharField(required=False, allow_blank=True, default="")
    template = serializers.UUIDField()
    template_variables = serializers.DictField(required=False, default=dict)
