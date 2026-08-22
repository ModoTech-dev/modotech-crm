from rest_framework import viewsets, permissions
from apps.accounts.permissions import IsAdminOrAbove, IsSuperAdminOnly
from .models import Department, RoutingRule
from .serializers import DepartmentSerializer, RoutingRuleSerializer


class RoutingRuleViewSet(viewsets.ModelViewSet):
    """
    Admin-configurable routing rules (spec section 13). The keyword
    routing service (apps.conversations.services.routing) checks these
    first, falling back to the hard-coded KEYWORD_ROUTES defaults if
    none match — so an empty table doesn't break inbound routing.
    """

    queryset = RoutingRule.objects.all()
    serializer_class = RoutingRuleSerializer
    permission_classes = [IsAdminOrAbove]
    filterset_fields = ["department", "is_active"]


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    Read is open to any authenticated user (dropdowns everywhere need this).
    Write is Super Admin only — the department catalog shapes conversation
    routing and agent assignment org-wide, so changing it sits at the same
    tier as creating agents or assigning roles, not general Admin.
    """

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [permissions.IsAuthenticated()]
        return [IsSuperAdminOnly()]
