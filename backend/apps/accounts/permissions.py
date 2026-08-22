"""
Role-based permission classes shared across the API.

Kept intentionally simple (role -> allowed) rather than a full permission
matrix table, per the spec's "don't create unnecessary abstractions" rule.
Expand to django-guardian style object permissions only if a concrete
need arises.
"""
from rest_framework.permissions import BasePermission

from .models import Role


class IsManagerOrAbove(BasePermission):
    message = "Manager, admin, or super admin role required."

    def has_permission(self, request, view):
        user = request.user
        # Django superusers (created via createsuperuser) bypass the
        # role-tier checks — is_superuser and the CRM's own `role` field
        # are independent, and a superuser should never be locked out of
        # their own instance because they haven't also set role=ADMIN.
        return bool(user and user.is_authenticated and (user.is_superuser or user.is_manager_tier))


class IsAdminOrAbove(BasePermission):
    message = "Admin or super admin role required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.is_admin_tier))


class IsSuperAdminOnly(BasePermission):
    """
    The strictest tier — reserved for the handful of actions that shape
    who can access the system at all: creating agent accounts, assigning
    roles, and managing the department catalog. A regular Admin can run
    day-to-day operations (templates, broadcasts, routing rules, audit
    logs) but does not get to create new logins or change what role
    someone holds — that stays with Super Admin only.
    """

    message = "Super admin role required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or user.role == Role.SUPER_ADMIN))


class IsAgentOwnerOrManager(BasePermission):
    """
    Object-level check: agents may only touch conversations assigned to
    them; managers/admins may touch anything.
    """

    message = "You can only act on conversations assigned to you."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_manager_tier:
            return True
        assigned_agent = getattr(obj, "assigned_agent", None) or getattr(
            getattr(obj, "conversation", None), "assigned_agent", None
        )
        return assigned_agent_id_matches(assigned_agent, user)


def assigned_agent_id_matches(assigned_agent, user):
    return assigned_agent is not None and assigned_agent.id == user.id


class CanAccessFinancialReports(BasePermission):
    message = "Financial report access is restricted."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_manager_tier or user.role == Role.FINANCE))
