from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ["email"]
    list_display = ["email", "first_name", "last_name", "role", "department", "is_active", "is_staff"]
    list_filter = ["role", "department", "is_active"]
    search_fields = ["email", "first_name", "last_name", "phone"]
    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Modotech CRM", {"fields": ("role", "department", "phone", "is_online")}),
    )
