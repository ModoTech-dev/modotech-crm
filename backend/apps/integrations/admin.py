from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ["action", "user", "object_type", "object_id", "ip_address", "created_at"]
    list_filter = ["action", "object_type"]
    search_fields = ["object_id", "user__email"]
    readonly_fields = [f.name for f in AuditLog._meta.fields]
