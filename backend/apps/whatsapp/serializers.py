from rest_framework import serializers
from .models import Broadcast, BroadcastRecipient, MessageTemplate


class MessageTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageTemplate
        fields = ["id", "name", "category", "language", "body", "status", "meta_template_id", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "meta_template_id", "created_at", "updated_at"]


class BroadcastRecipientSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    customer_whatsapp_number = serializers.SerializerMethodField()
    likely_not_on_whatsapp = serializers.SerializerMethodField()

    class Meta:
        model = BroadcastRecipient
        fields = ["id", "customer", "customer_name", "customer_whatsapp_number", "status", "error", "likely_not_on_whatsapp"]
        read_only_fields = fields

    def get_customer_whatsapp_number(self, obj):
        from apps.customers.services.phone_masking import visible_number

        return visible_number(obj.customer.whatsapp_number, self.context.get("request"))

    def get_likely_not_on_whatsapp(self, obj):
        from .services.failure_classification import is_likely_not_on_whatsapp

        return obj.status == "FAILED" and is_likely_not_on_whatsapp(obj.error)


class BroadcastSerializer(serializers.ModelSerializer):
    template_name = serializers.CharField(source="template.name", read_only=True)
    recipient_count = serializers.SerializerMethodField()

    class Meta:
        model = Broadcast
        fields = [
            "id", "name", "template", "template_name", "customer_status_filter", "tag_filter",
            "status", "sent_count", "failed_count", "error", "recipient_count",
            "created_at", "started_at", "completed_at",
        ]
        read_only_fields = ["id", "status", "sent_count", "failed_count", "error", "created_at", "started_at", "completed_at"]

    def get_recipient_count(self, obj):
        from apps.customers.models import Customer

        qs = Customer.objects.all()
        if obj.customer_status_filter:
            qs = qs.filter(status=obj.customer_status_filter)
        if obj.tag_filter_id:
            qs = qs.filter(tags=obj.tag_filter_id)
        return qs.distinct().count()
