from rest_framework import serializers
from .models import Department, RoutingRule


class RoutingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutingRule
        fields = ["id", "keyword", "department", "is_active", "priority", "created_at"]
        read_only_fields = ["id", "created_at"]


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ["id", "name", "code", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
