from django.contrib import admin
from .models import Conversation, ConversationAssignment, InternalNote, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ["whatsapp_message_id", "timestamp", "created_at"]


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ["customer", "assigned_agent", "department", "status", "priority", "last_message_at"]
    list_filter = ["status", "priority", "department"]
    search_fields = ["customer__name", "customer__whatsapp_number"]
    inlines = [MessageInline]


@admin.register(ConversationAssignment)
class ConversationAssignmentAdmin(admin.ModelAdmin):
    list_display = ["conversation", "previous_agent", "new_agent", "assigned_by", "created_at"]


@admin.register(InternalNote)
class InternalNoteAdmin(admin.ModelAdmin):
    list_display = ["conversation", "author", "created_at"]
