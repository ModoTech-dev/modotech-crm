from django.contrib import admin
from .models import Customer, Tag


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ["name", "whatsapp_number", "status", "account_number", "last_contact_at"]
    list_filter = ["status", "tags"]
    search_fields = ["name", "whatsapp_number", "account_number", "email"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["name", "color"]
