from datetime import datetime, timedelta

from django.db.models import Avg, Count, F, Q
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Role, User
from apps.accounts.permissions import IsManagerOrAbove
from apps.conversations.models import Conversation, ConversationStatus, Message, SenderType
from apps.customers.models import Customer, CustomerStatus, LeadOutcome


class DashboardStatsView(APIView):
    """
    Backs spec section 6 — the CRM dashboard's headline numbers.

    Scope depends on role: Manager tier and above (Manager, Admin, Super
    Admin) see the full org-wide picture — everyone else sees a personal
    view scoped to their own assigned work. An agent doesn't need (and
    shouldn't default to seeing) company-wide numbers; what matters to
    them day to day is their own queue.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        if user.is_manager_tier or user.is_superuser:
            data = {
                "scope": "org",
                "total_customers": Customer.objects.count(),
                "new_leads": Customer.objects.filter(status=CustomerStatus.LEAD).count(),
                "open_conversations": Conversation.objects.filter(status=ConversationStatus.OPEN).count(),
                "pending_conversations": Conversation.objects.filter(status=ConversationStatus.PENDING).count(),
                "resolved_conversations": Conversation.objects.filter(status=ConversationStatus.RESOLVED).count(),
                "unassigned_conversations": Conversation.objects.filter(assigned_agent__isnull=True).exclude(
                    status__in=[ConversationStatus.RESOLVED, ConversationStatus.CLOSED]
                ).count(),
                "active_agents": User.objects.filter(
                    is_active=True, role__in=[Role.AGENT, Role.SUPPORT, Role.SALES, Role.FINANCE]
                ).count(),
                "todays_incoming_messages": Message.objects.filter(
                    sender_type=SenderType.CUSTOMER, timestamp__gte=today_start
                ).count(),
                "todays_outgoing_messages": Message.objects.filter(
                    sender_type=SenderType.AGENT, timestamp__gte=today_start
                ).count(),
            }
        else:
            mine = Conversation.objects.filter(assigned_agent=user)
            data = {
                "scope": "personal",
                "my_open_conversations": mine.filter(status=ConversationStatus.OPEN).count(),
                "my_pending_conversations": mine.filter(status=ConversationStatus.PENDING).count(),
                "my_resolved_conversations": mine.filter(status=ConversationStatus.RESOLVED).count(),
                "my_unread_conversations": mine.filter(unread_count__gt=0).count(),
                "my_messages_sent_today": Message.objects.filter(
                    sender_user=user, timestamp__gte=today_start
                ).count(),
            }
        return Response(data)


class AgentPerformanceView(APIView):
    """
    Backs spec sections 6/29 — per-agent conversation and response
    metrics, plus lead outcome breakdown, for managers to review team
    performance and calculate payroll based on actual monthly results.

    Everything here — conversations, messages, AND lead outcomes — is
    scoped to a specific calendar month via lead_outcome_updated_at
    (pass ?year=&month=, defaults to the current month). This is what
    makes "how many leads did this agent close successfully in March"
    an honest, answerable question: it's based on when the outcome was
    actually set, not just its current value.

    One real limitation, worth knowing: leads whose outcome was set
    BEFORE this tracking existed have no change timestamp and won't
    appear in any monthly count until their outcome is touched again —
    there's no way to retroactively know when those were actually
    decided. Going forward, from now on, every outcome change is
    timestamped correctly.
    """

    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        now = timezone.now()
        year = int(request.query_params.get("year", now.year))
        month = int(request.query_params.get("month", now.month))

        month_start = timezone.make_aware(datetime(year, month, 1))
        month_end = timezone.make_aware(datetime(year + 1, 1, 1)) if month == 12 else timezone.make_aware(datetime(year, month + 1, 1))

        def in_month(field):
            return Q(**{f"{field}__gte": month_start}) & Q(**{f"{field}__lt": month_end})

        agents = User.objects.filter(
            role__in=[Role.AGENT, Role.SUPPORT, Role.SALES, Role.FINANCE]
        ).annotate(
            conversations_handled=Count(
                "assigned_conversations",
                filter=in_month("assigned_conversations__created_at"),
                distinct=True,
            ),
            messages_sent=Count(
                "sent_messages",
                filter=in_month("sent_messages__timestamp"),
                distinct=True,
            ),
            open_conversations=Count(
                "assigned_conversations",
                filter=Q(assigned_conversations__status__in=[ConversationStatus.OPEN, ConversationStatus.PENDING]),
                distinct=True,
            ),
            resolved_conversations=Count(
                "assigned_conversations",
                filter=in_month("assigned_conversations__created_at") & Q(assigned_conversations__status=ConversationStatus.RESOLVED),
                distinct=True,
            ),
            leads_successful=Count(
                "assigned_conversations__customer",
                filter=in_month("assigned_conversations__customer__lead_outcome_updated_at")
                & Q(assigned_conversations__customer__lead_outcome=LeadOutcome.SUCCESSFUL),
                distinct=True,
            ),
            leads_pending=Count(
                "assigned_conversations__customer",
                filter=in_month("assigned_conversations__customer__lead_outcome_updated_at")
                & Q(assigned_conversations__customer__lead_outcome=LeadOutcome.PENDING),
                distinct=True,
            ),
            leads_rejected=Count(
                "assigned_conversations__customer",
                filter=in_month("assigned_conversations__customer__lead_outcome_updated_at")
                & Q(assigned_conversations__customer__lead_outcome=LeadOutcome.REJECTED),
                distinct=True,
            ),
        )

        results = [
            {
                "agent_id": str(agent.id),
                "name": agent.get_full_name() or agent.email,
                "conversations_handled": agent.conversations_handled,
                "messages_sent": agent.messages_sent,
                "open_conversations": agent.open_conversations,
                "resolved_conversations": agent.resolved_conversations,
                "leads_successful": agent.leads_successful,
                "leads_pending": agent.leads_pending,
                "leads_rejected": agent.leads_rejected,
            }
            for agent in agents
        ]
        return Response({
            "year": year,
            "month": month,
            "agents": results,
        })
