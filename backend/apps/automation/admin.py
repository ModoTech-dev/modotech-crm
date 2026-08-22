from django.contrib import admin
from .models import AutomationRule, Department, RoutingRule


@admin.register(RoutingRule)
class RoutingRuleAdmin(admin.ModelAdmin):
    list_display = ["keyword", "department", "priority", "is_active"]
    list_filter = ["department", "is_active"]


@admin.register(AutomationRule)
class AutomationRuleAdmin(admin.ModelAdmin):
    list_display = ["name", "trigger", "template", "is_active"]
    list_filter = ["trigger", "is_active"]


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["name", "code", "is_active"]
    search_fields = ["name", "code"]
