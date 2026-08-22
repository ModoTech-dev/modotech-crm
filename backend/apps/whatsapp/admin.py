from django.contrib import admin
from .models import Broadcast, BroadcastRecipient, MessageTemplate


@admin.register(MessageTemplate)
class MessageTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "category", "language", "status", "updated_at"]
    list_filter = ["status", "category"]
    search_fields = ["name"]


class BroadcastRecipientInline(admin.TabularInline):
    model = BroadcastRecipient
    extra = 0
    readonly_fields = ["customer", "status", "whatsapp_message_id", "error"]


@admin.register(Broadcast)
class BroadcastAdmin(admin.ModelAdmin):
    list_display = ["name", "template", "status", "sent_count", "failed_count", "created_at"]
    list_filter = ["status"]
    inlines = [BroadcastRecipientInline]
