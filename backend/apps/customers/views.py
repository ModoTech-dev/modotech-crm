from django.db.models import Q
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.exceptions import NotFound

from apps.accounts.permissions import IsAdminOrAbove
from apps.integrations.services.isp import get_isp_service
from .models import Customer, Tag
from .serializers import CustomerSerializer, TagSerializer, ISPAccountSerializer
from .services.phone_validation import validate_phone_format

MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024  # 5MB — generous for a contact spreadsheet


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.prefetch_related("tags").all()
    serializer_class = CustomerSerializer
    filterset_fields = ["status", "tags"]
    filter_backends = [filters.SearchFilter]
    # Indexed, fast search across the fields the spec calls out (section 15)
    search_fields = ["name", "phone", "whatsapp_number", "account_number", "email"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admin tier and above see every customer; everyone else sees
        # ONLY customers currently or previously assigned to them —
        # deliberately strict, not "ever sent a message to." A broader
        # "interacted with" rule let an agent keep seeing a customer
        # indefinitely even after the conversation was reassigned away
        # from them, which isn't what "assigned to them" means.
        if not user.is_admin_tier:
            qs = qs.filter(conversations__assigned_agent=user).distinct()

        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(name__icontains=q)
                | Q(phone__icontains=q)
                | Q(whatsapp_number__icontains=q)
                | Q(account_number__icontains=q)
                | Q(email__icontains=q)
                | Q(isp_customer_id__icontains=q)
            )
        return qs

    @action(detail=True, methods=["get"], url_path="primary-conversation")
    def primary_conversation(self, request, pk=None):
        """
        Resolves "click a customer, land in their chat" — returns their
        most relevant open conversation, if the requester can actually
        see it (get_object() already applies the same visibility scope
        as the list view, so an agent can't probe for a customer outside
        their own assigned/interacted-with set this way either).
        """
        from apps.conversations.models import Conversation
        from apps.conversations.serializers import ConversationListSerializer

        customer = self.get_object()
        conversation = (
            Conversation.objects.filter(customer=customer)
            .exclude(status__in=["RESOLVED", "CLOSED"])
            .order_by("-last_message_at")
            .first()
        )
        if not conversation:
            return Response({"conversation": None})
        return Response({"conversation": ConversationListSerializer(conversation, context={"request": request}).data})

    @action(detail=False, methods=["get"], url_path="check-number")
    def check_number(self, request):
        """
        Format-validity check only — see phone_validation.py for why this
        can't confirm actual WhatsApp registration, and the response
        always includes a note making that limit explicit to the caller.
        """
        result = validate_phone_format(request.query_params.get("number", ""))
        if result["valid"]:
            result["note"] = "Valid number format. WhatsApp delivery is confirmed once a message is actually sent."
        return Response(result)

    @action(detail=True, methods=["get"], url_path="isp")
    def isp(self, request, pk=None):
        customer = self.get_object()
        if not customer.isp_customer_id:
            raise NotFound("This customer has no linked ISP account.")
        account = get_isp_service().get_customer(customer.isp_customer_id)
        if account is None:
            raise NotFound("ISP account not found.")
        return Response(ISPAccountSerializer(account.to_dict()).data)

    @action(
        detail=False, methods=["post"], url_path="bulk-import",
        parser_classes=[MultiPartParser], permission_classes=[IsAdminOrAbove],
    )
    def bulk_import(self, request):
        """
        Admin-tier only, deliberately: imported contacts have no
        assigned agent yet (there's no conversation for them), and since
        the Customers/Leads tab is now strictly assigned-only for
        regular agents, an agent importing their own contacts wouldn't
        even be able to see them afterward. Admin-tier already sees
        everyone, so they can review and assign what comes in.
        """
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            raise ValidationError({"file": "No file was uploaded."})
        if uploaded_file.size > MAX_IMPORT_FILE_SIZE:
            raise ValidationError({"file": f"File is too large (max {MAX_IMPORT_FILE_SIZE // (1024 * 1024)}MB)."})
        if not uploaded_file.name.lower().endswith((".csv", ".xlsx", ".xls")):
            raise ValidationError({"file": "Only .csv, .xlsx, or .xls files are supported."})

        from .services.bulk_import import bulk_import_contacts

        result = bulk_import_contacts(uploaded_file, uploaded_file.name)
        if result.get("error"):
            raise ValidationError({"file": result["error"]})
        return Response(result)


class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
