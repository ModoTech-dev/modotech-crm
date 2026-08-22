"""
Keyword-based auto-routing (spec section 13) and auto-assignment
(section 14). Keyword rules are hard-coded as a sensible default for
v1; TODO Phase 9 — move to a RoutingRule model editable from Settings
so admins can configure this from the UI without a deploy.
"""
from __future__ import annotations

DEPARTMENT_GENERAL = "GENERAL"

# Built-in fallback keyword routes, used only when no active RoutingRule
# in the Settings > Departments/Routing catalog matches. Department codes
# here are plain strings so they stay in sync with whatever an admin has
# actually created in the Department catalog (apps.automation.models.Department) —
# no hard-coded enum to drift out of date with it.
KEYWORD_ROUTES: dict[str, list[str]] = {
    "SALES": ["price", "package", "internet", "installation", "upgrade"],
    "TECHNICAL": ["down", "slow", "not working", "router", "wifi", "outage"],
    "FINANCE": ["payment", "m-pesa", "mpesa", "pay", "invoice", "balance"],
}


def route_department(message_text: str) -> str:
    text = (message_text or "").lower()

    # Admin-configured rules (apps.automation.models.RoutingRule) win over
    # the hard-coded defaults, highest priority first.
    from apps.automation.models import RoutingRule

    for rule in RoutingRule.objects.filter(is_active=True).order_by("-priority"):
        if rule.keyword.lower() in text:
            return rule.department

    for department, keywords in KEYWORD_ROUTES.items():
        if any(keyword in text for keyword in keywords):
            return department
    return DEPARTMENT_GENERAL


class AssignmentStrategy:
    ROUND_ROBIN = "ROUND_ROBIN"
    LEAST_LOADED = "LEAST_LOADED"


def pick_agent(department: str, strategy: str = AssignmentStrategy.LEAST_LOADED):
    """Returns the User to auto-assign a new conversation to, or None if
    no eligible agent is online/available."""
    from apps.accounts.models import Role, User
    from apps.conversations.models import Conversation, ConversationStatus

    eligible = User.objects.filter(
        is_active=True, role__in=[Role.AGENT, Role.SUPPORT, Role.SALES, Role.FINANCE]
    )
    if department and department != DEPARTMENT_GENERAL:
        eligible = eligible.filter(department=department)
    if not eligible.exists():
        return None

    if strategy == AssignmentStrategy.LEAST_LOADED:
        return min(
            eligible,
            key=lambda agent: Conversation.objects.filter(
                assigned_agent=agent
            ).exclude(status__in=[ConversationStatus.RESOLVED, ConversationStatus.CLOSED]).count(),
        )

    # ROUND_ROBIN: pick whoever was assigned longest ago (or never)
    return (
        eligible.order_by("assigned_conversations__created_at").first()
        or eligible.first()
    )
