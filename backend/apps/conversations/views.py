from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.integrations.services.audit import log_action
from apps.integrations.services.storage import save_media
from apps.whatsapp.services.meta_client import WhatsAppAPIError, get_whatsapp_client
from .models import Conversation, ConversationAssignment, InternalMessage, InternalNote, Message
from .serializers import (
    AssignConversationSerializer,
    ConversationAssignmentSerializer,
    ConversationDetailSerializer,
    ConversationListSerializer,
    InternalMessageSerializer,
    InternalNoteSerializer,
    MessageSerializer,
    SendMessageSerializer,
)
from apps.customers.models import Customer
from apps.customers.serializers import StartConversationSerializer
from apps.whatsapp.models import MessageTemplate
from .services.realtime import notify_agent, push_conversation_update, push_new_message

MAX_MEDIA_UPLOAD_SIZE = 16 * 1024 * 1024  # 16MB — generous, comfortably under WhatsApp's own per-type caps


def infer_message_type_from_mime(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "IMAGE"
    if mime_type.startswith("video/"):
        return "VIDEO"
    if mime_type.startswith("audio/"):
        return "AUDIO"
    return "DOCUMENT"


def friendly_whatsapp_error(exc: WhatsAppAPIError) -> str:
    """
    WhatsAppAPIError's message is our own f-string wrapping Meta's raw
    JSON error body. Pull out Meta's own `error.message` when present —
    it's usually specific and readable on its own (e.g. "Access denied",
    or a note that the recipient can't receive messages) — and fall back
    to the raw text only if that parsing fails, so nothing is ever
    silently swallowed.
    """
    import json
    import re

    match = re.search(r"\{.*\}", str(exc))
    if match:
        try:
            payload = json.loads(match.group(0))
            meta_message = payload.get("error", {}).get("message")
            if meta_message:
                return f"WhatsApp couldn't deliver this: {meta_message}"
        except (ValueError, AttributeError):
            pass
    return f"WhatsApp couldn't deliver this message: {exc}"


def agent_initials(user) -> str:
    """
    "Gloria Wanjiru" -> "GW" — appended to an agent's own text replies so
    customers can tell which staff member they're actually talking to,
    since a conversation may be handled by different agents over time.
    Deliberately only used for genuine free-form text replies, never
    template messages: a template's content is fixed and Meta-approved
    exactly as submitted, and appending anything to it would mean the
    outgoing message no longer matches what was approved.
    """
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    initials = f"{first[:1]}{last[:1]}".upper()
    return initials


class ConversationViewSet(viewsets.ModelViewSet):
    queryset = Conversation.objects.select_related("customer", "assigned_agent").prefetch_related("tags")
    filterset_fields = ["status", "priority", "department", "assigned_agent"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "list":
            return ConversationListSerializer
        return ConversationDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Agents only see their own or unassigned conversations in their
        # department; managers/admins see everything (spec sections 8-10).
        if not user.is_manager_tier:
            qs = qs.filter(
                models_q_agent_scope(user)
            )
        # Two extra query params beyond the simple exact-match fields
        # filterset_fields already covers above — these need real
        # lookups (isnull, greater-than) rather than a plain equality
        # check, which is why they're handled explicitly here instead
        # of just being added to that list. Used by the Dashboard's
        # clickable tiles to link straight to a correctly filtered
        # Inbox view for each stat.
        if self.request.query_params.get("unassigned") == "true":
            qs = qs.filter(assigned_agent__isnull=True)
        if self.request.query_params.get("unread") == "true":
            qs = qs.filter(unread_count__gt=0)
        if self.request.query_params.get("mine") == "true":
            # Deliberately a separate param name from assigned_agent —
            # that one is already a django-filter field expecting a real
            # UUID; reusing it for a "me" shortcut would collide with
            # its own auto-generated exact-match filtering.
            qs = qs.filter(assigned_agent=user)
        return qs

    def destroy(self, request, *args, **kwargs):
        # DELETE is allowed at the class level now (needed for the nested
        # delete_message action below), but a whole Conversation should
        # still never be hard-deletable — that was the entire point of
        # restricting this before, and this override keeps that intact.
        raise PermissionDenied("Conversations can't be deleted. Use status=CLOSED instead.")

    @action(detail=False, methods=["post"])
    def start(self, request):
        """
        Agent-initiated outreach: create (or reuse) a Customer by
        WhatsApp number, then send an approved template to open the
        conversation. Sending a template is the only way to reach
        someone who has never messaged in first — WhatsApp does not
        allow free-form text to a number outside an active 24h customer
        service window, and a brand-new contact has no window at all.
        """
        serializer = StartConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            template = MessageTemplate.objects.get(id=data["template"], status="APPROVED")
        except MessageTemplate.DoesNotExist:
            raise ValidationError({"template": "This template doesn't exist or isn't APPROVED yet."})

        customer, created = Customer.objects.get_or_create(
            whatsapp_number=data["whatsapp_number"],
            defaults={
                "name": data.get("name", ""),
                "email": data.get("email", ""),
                "location": data.get("location", ""),
                "status": "LEAD",
            },
        )

        # Send BEFORE creating/touching any Conversation — if this fails,
        # there should be no empty, message-less conversation left behind
        # in the inbox. The Customer record itself is fine to keep either
        # way: the agent's data entry (name, number) shouldn't be lost
        # just because this particular send attempt failed, and they may
        # want to retry with a different template.
        client = get_whatsapp_client()
        try:
            wamid = client.send_message(
                to=customer.whatsapp_number,
                message_type="TEMPLATE",
                template_name=template.name,
                template_variables=data.get("template_variables"),
            )
        except WhatsAppAPIError as exc:
            return Response({"detail": friendly_whatsapp_error(exc)}, status=502)

        # Reuse an existing open thread rather than spawning a duplicate
        # conversation every time an agent reaches out to the same
        # customer — mirrors the same dedupe the inbound webhook does.
        conversation = (
            Conversation.objects.filter(customer=customer)
            .exclude(status__in=["RESOLVED", "CLOSED"])
            .order_by("-last_message_at")
            .first()
        )
        is_new_conversation = conversation is None
        if is_new_conversation:
            conversation = Conversation.objects.create(
                customer=customer,
                department=data.get("department") or "GENERAL",
                assigned_agent=request.user,
            )
        elif not conversation.assigned_agent:
            conversation.assigned_agent = request.user
            conversation.save(update_fields=["assigned_agent"])

        message = Message.objects.create(
            conversation=conversation,
            sender_type="AGENT",
            sender_user=request.user,
            whatsapp_message_id=wamid,
            message_type="TEMPLATE",
            content=f"[Template: {template.name}]",
            status="SENT",
            timestamp=timezone.now(),
        )
        conversation.last_message_at = message.timestamp
        conversation.save(update_fields=["last_message_at", "updated_at"])

        log_action(
            user=request.user, action="CONVERSATION_STARTED", request=request, target=conversation,
            metadata={"customer_created": created, "template": template.name},
        )
        push_new_message(conversation, message)
        push_conversation_update(conversation, event="conversation_created" if is_new_conversation else "conversation_updated")

        return Response(ConversationDetailSerializer(conversation, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        conversation = self.get_object()
        serializer = AssignConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if not request.user.is_manager_tier and request.user.role not in ("AGENT",):
            raise PermissionDenied("You are not allowed to reassign conversations.")

        new_agent = User.objects.filter(id=serializer.validated_data["agent_id"], is_active=True).first()
        if not new_agent:
            raise ValidationError({"agent_id": "No active agent with this id."})

        previous_agent = conversation.assigned_agent
        conversation.assigned_agent = new_agent
        conversation.save(update_fields=["assigned_agent", "updated_at"])

        ConversationAssignment.objects.create(
            conversation=conversation,
            previous_agent=previous_agent,
            new_agent=new_agent,
            assigned_by=request.user,
            reason=serializer.validated_data["reason"],
        )
        log_action(user=request.user, action="CONVERSATION_ASSIGNED", request=request, target=conversation,
                   metadata={"new_agent": str(new_agent.id)})
        notify_agent(new_agent.id, {"title": "New conversation assigned", "conversation_id": str(conversation.id)})
        push_conversation_update(conversation, event="conversation_assigned")
        return Response(ConversationDetailSerializer(conversation, context={"request": request}).data)

    @action(detail=True, methods=["patch"], url_path="status")
    def set_status(self, request, pk=None):
        conversation = self.get_object()
        new_status = request.data.get("status")
        if new_status not in dict(Conversation._meta.get_field("status").choices):
            raise ValidationError({"status": "Invalid status."})
        conversation.status = new_status
        conversation.save(update_fields=["status", "updated_at"])
        log_action(user=request.user, action="CONVERSATION_STATUS_CHANGED", request=request, target=conversation,
                   metadata={"status": new_status})
        push_conversation_update(conversation)
        return Response(ConversationDetailSerializer(conversation, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        """
        Clears unread_count when an agent opens a conversation. This is a
        shared-inbox count (one field on the Conversation, not per-agent),
        matching the rest of this app's model — so clearing it here also
        pushes an update to every other connected agent's screen, since
        "someone already looked at this" is meaningful for the whole team,
        not just the agent who happened to open it.
        """
        conversation = self.get_object()
        if conversation.unread_count > 0:
            conversation.unread_count = 0
            conversation.save(update_fields=["unread_count"])
            push_conversation_update(conversation, event="conversation_updated")
        return Response(ConversationDetailSerializer(conversation, context={"request": request}).data)

    @action(detail=True, methods=["get", "post"])
    def messages(self, request, pk=None):
        conversation = self.get_object()

        if request.method == "GET":
            qs = conversation.messages.all()
            return Response(MessageSerializer(qs, many=True).data)

        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        client = get_whatsapp_client()
        location = None
        if data["message_type"] == "LOCATION":
            location = {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "name": data.get("location_name"),
                "address": data.get("location_address"),
            }

        outgoing_content = data["content"]
        # Only append to genuine free-form text — never to a template
        # send (fixed, Meta-approved content), only for regular staff
        # (not Admin/Super Admin — management-tier sends don't get this),
        # and only when we actually have real initials to add, so a
        # staff member with no name set doesn't get a stray sign-off.
        if data["message_type"] == "TEXT" and not data.get("template_name") and not request.user.is_admin_tier:
            initials = agent_initials(request.user)
            if initials:
                outgoing_content = f"{data['content']}\nRegards - {initials}"

        try:
            wamid = client.send_message(
                to=conversation.customer.whatsapp_number,
                message_type=data["message_type"],
                content=outgoing_content,
                template_name=data.get("template_name"),
                template_variables=data.get("template_variables"),
                media_path=data.get("media_path"),
                location=location,
            )
        except WhatsAppAPIError as exc:
            # Meta's own send-time rejection is the one authoritative
            # signal we actually have for "this number can't receive
            # WhatsApp messages" — surface it clearly instead of a raw
            # 500, since the agent needs to know right away, not just see
            # a generic failure.
            return Response({"detail": friendly_whatsapp_error(exc)}, status=502)

        message = Message.objects.create(
            conversation=conversation,
            sender_type="AGENT",
            sender_user=request.user,
            whatsapp_message_id=wamid,
            message_type=data["message_type"],
            # For a location share, content holds a human-readable fallback
            # (used in list previews/search) while the actual coordinates
            # live in metadata, where MessageSerializer/MessageBubble read
            # them from for rendering an actual map link. Otherwise, store
            # exactly what was actually sent (including the initials, if
            # added above) so the CRM's own record matches reality.
            content=data.get("location_name") or "Location" if location else outgoing_content,
            media_path=data.get("media_path", ""),
            metadata=location or {},
            status="SENT",
            timestamp=timezone.now(),
        )
        conversation.last_message_at = message.timestamp
        conversation.save(update_fields=["last_message_at", "updated_at"])

        push_new_message(conversation, message)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="send-media", parser_classes=[MultiPartParser])
    def send_media(self, request, pk=None):
        """
        Upload a file from the agent's own computer and send it as an
        image/document/audio/video message. Uploads to WhatsApp first to
        get a media_id (works regardless of whether our own server is
        publicly reachable — the correct approach for agent-originated
        files, vs. a media_path/link for something already hosted
        elsewhere), and separately keeps our own local copy so the file
        displays in the CRM without depending on WhatsApp's media URLs,
        which expire after a few minutes.
        """
        conversation = self.get_object()
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            raise ValidationError({"file": "No file was uploaded."})
        if uploaded_file.size > MAX_MEDIA_UPLOAD_SIZE:
            raise ValidationError({"file": f"File is too large (max {MAX_MEDIA_UPLOAD_SIZE // (1024 * 1024)}MB)."})

        content = uploaded_file.read()
        mime_type = uploaded_file.content_type or "application/octet-stream"
        message_type = request.data.get("message_type") or infer_message_type_from_mime(mime_type)
        caption = request.data.get("content", "")

        # Save our own copy first — if the WhatsApp send fails below, the
        # agent doesn't lose the file and can retry without re-picking it.
        local_path = save_media(uploaded_file.name, content)

        client = get_whatsapp_client()
        try:
            media_id = client.upload_media(content, mime_type, uploaded_file.name)
            wamid = client.send_message(
                to=conversation.customer.whatsapp_number,
                message_type=message_type,
                content=caption,
                media_id=media_id,
            )
        except WhatsAppAPIError as exc:
            return Response({"detail": friendly_whatsapp_error(exc)}, status=502)

        message = Message.objects.create(
            conversation=conversation,
            sender_type="AGENT",
            sender_user=request.user,
            whatsapp_message_id=wamid,
            message_type=message_type,
            content=caption,
            media_path=local_path,
            media_mime_type=mime_type,
            status="SENT",
            timestamp=timezone.now(),
        )
        conversation.last_message_at = message.timestamp
        conversation.save(update_fields=["last_message_at", "updated_at"])

        push_new_message(conversation, message)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path="messages/(?P<message_id>[^/.]+)")
    def delete_message(self, request, pk=None, message_id=None):
        """
        Removes a message from the CRM's own view only. WhatsApp's
        official Cloud API has no ability to recall a message from the
        customer's phone once sent — that's a consumer-app-only feature
        ("delete for everyone"), not something the Business Platform
        exposes. The message content is kept in the database (never
        hard-deleted) for audit purposes; only its display is suppressed,
        matching how WhatsApp itself shows "This message was deleted."

        Deliberately restricted to messages the requesting agent sent
        themselves — a CRM shouldn't let staff hide what a customer
        actually said, regardless of role.
        """
        conversation = self.get_object()
        message = conversation.messages.filter(id=message_id).first()
        if not message:
            raise ValidationError({"detail": "Message not found in this conversation."})
        if message.sender_type != "AGENT" or message.sender_user_id != request.user.id:
            raise PermissionDenied("You can only remove messages you sent yourself.")
        if message.is_deleted:
            return Response(MessageSerializer(message).data)

        message.is_deleted = True
        message.deleted_at = timezone.now()
        message.deleted_by = request.user
        message.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

        log_action(
            user=request.user, action="MESSAGE_DELETED_FROM_CRM", request=request, target=message,
            metadata={"conversation_id": str(conversation.id)},
        )
        push_conversation_update(conversation, event="conversation_updated")
        return Response(MessageSerializer(message).data)

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            return Response(InternalNoteSerializer(conversation.internal_notes.all(), many=True).data)

        serializer = InternalNoteSerializer(data={**request.data, "conversation": conversation.id})
        serializer.is_valid(raise_exception=True)
        note = serializer.save(author=request.user)
        return Response(InternalNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="assignment-history")
    def assignment_history(self, request, pk=None):
        conversation = self.get_object()
        return Response(ConversationAssignmentSerializer(conversation.assignment_history.all(), many=True).data)


class ParseMapsLinkView(APIView):
    """Turns a pasted Google Maps link into coordinates the agent can
    actually send — see apps.integrations.services.maps_link for the
    parsing details and why short links need a network round-trip."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        url = (request.data.get("url") or "").strip()
        if not url:
            raise ValidationError({"url": "Paste a Google Maps link."})

        from apps.integrations.services.maps_link import parse_google_maps_url

        result = parse_google_maps_url(url)
        if not result:
            raise ValidationError({
                "url": "Couldn't find a location in that link. Try copying it directly from Google Maps' own Share button.",
            })
        return Response(result)


class InternalMessageViewSet(viewsets.GenericViewSet):
    """
    Staff-to-staff messaging, separate entirely from customer WhatsApp
    conversations. `threads` mirrors how the customer Inbox groups by
    conversation partner, so this should feel immediately familiar to
    anyone already using the rest of the CRM.
    """

    serializer_class = InternalMessageSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        return InternalMessage.objects.filter(
            Q(sender=user) | Q(recipient=user)
        ).select_related("sender", "recipient", "referenced_customer")

    @action(detail=False, methods=["get"])
    def colleagues(self, request):
        """Every other active staff member — the directory used to
        start a NEW conversation, distinct from `threads` below (which
        only shows people you've already exchanged messages with)."""
        colleagues = User.objects.filter(is_active=True).exclude(id=request.user.id).order_by("first_name", "email")
        return Response([
            {"id": str(u.id), "name": u.get_full_name() or u.email, "role": u.role}
            for u in colleagues
        ])

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """A single global count, used for the Sidebar badge and to
        decide whether an incoming message needs a toast notification —
        deliberately cheap (one query, no thread grouping) since this
        gets checked far more often than the full threads list."""
        count = InternalMessage.objects.filter(recipient=request.user, read_at__isnull=True).count()
        return Response({"count": count})

    @action(detail=False, methods=["get"])
    def threads(self, request):
        """One row per colleague you've exchanged messages with, newest
        first, with an unread count — small dataset (staff, not
        customers), so grouping in Python here is simple and plenty
        fast rather than needing a more complex aggregate query."""
        user = request.user
        messages = self.get_queryset().order_by("-created_at")

        grouped: dict[str, dict] = {}
        for msg in messages:
            other = msg.recipient if msg.sender_id == user.id else msg.sender
            key = str(other.id)
            if key not in grouped:
                grouped[key] = {
                    "user_id": key,
                    "user_name": other.get_full_name() or other.email,
                    "last_message": msg.content,
                    "last_message_at": msg.created_at,
                    "unread_count": 0,
                }
            if msg.recipient_id == user.id and msg.read_at is None:
                grouped[key]["unread_count"] += 1

        return Response(sorted(grouped.values(), key=lambda t: t["last_message_at"], reverse=True))

    @action(detail=False, methods=["get"], url_path="with-user/(?P<user_id>[^/.]+)")
    def with_user(self, request, user_id=None):
        """Full history with one specific colleague, oldest first —
        marks their messages to you as read as a side effect of opening
        it, the same way opening a customer conversation does."""
        messages = self.get_queryset().filter(
            Q(sender_id=user_id, recipient=request.user) | Q(sender=request.user, recipient_id=user_id)
        ).order_by("created_at")

        InternalMessage.objects.filter(
            sender_id=user_id, recipient=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())

        return Response(InternalMessageSerializer(messages, many=True, context={"request": request}).data)

    def create(self, request):
        """Send a direct message to one specific colleague, optionally
        referencing a customer conversation and/or attaching a file —
        a message can be just a file with no caption, so content alone
        isn't required as long as a file is present."""
        recipient_id = request.data.get("recipient")
        content = (request.data.get("content") or "").strip()
        uploaded_file = request.FILES.get("file")

        if not recipient_id or (not content and not uploaded_file):
            raise ValidationError({"detail": "recipient is required, and either content or a file must be provided."})

        recipient = generics.get_object_or_404(User, id=recipient_id, is_active=True)
        referenced_customer_id = request.data.get("referenced_customer")
        referenced_customer = None
        if referenced_customer_id:
            # Same visibility scoping CustomerViewSet uses everywhere
            # else — you can only reference a customer you could already
            # see, so this never becomes a way to leak access to a
            # colleague's assigned customer that isn't yours.
            customer_qs = Customer.objects.all()
            if not request.user.is_admin_tier:
                customer_qs = customer_qs.filter(conversations__assigned_agent=request.user).distinct()
            referenced_customer = generics.get_object_or_404(customer_qs, id=referenced_customer_id)

        file_path, file_name, file_mime_type = "", "", ""
        if uploaded_file:
            if uploaded_file.size > MAX_MEDIA_UPLOAD_SIZE:
                raise ValidationError({"file": f"File is too large (max {MAX_MEDIA_UPLOAD_SIZE // (1024 * 1024)}MB)."})
            from apps.integrations.services.storage import save_internal_attachment
            import uuid as uuid_module

            file_path = save_internal_attachment(f"{uuid_module.uuid4()}_{uploaded_file.name}", uploaded_file.read())
            file_name = uploaded_file.name
            file_mime_type = uploaded_file.content_type or ""

        message = InternalMessage.objects.create(
            sender=request.user, recipient=recipient, content=content, referenced_customer=referenced_customer,
            file_path=file_path, file_name=file_name, file_mime_type=file_mime_type,
        )
        data = InternalMessageSerializer(message, context={"request": request}).data
        notify_agent(recipient.id, {"event": "internal_message", "message": data})
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"])
    def broadcast(self, request):
        """Super Admin only — sends the same message to every other
        active user at once. Implemented as one row per recipient (not
        one shared record) so each person's read-status is tracked
        correctly, rather than one row trying to represent "read by
        some, not others.\""""
        if request.user.role != "SUPER_ADMIN":
            raise PermissionDenied("Only Super Admin can message everyone at once.")

        content = (request.data.get("content") or "").strip()
        if not content:
            raise ValidationError({"detail": "content is required."})

        import uuid as uuid_module
        broadcast_id = uuid_module.uuid4()
        recipients = User.objects.filter(is_active=True).exclude(id=request.user.id)

        created = []
        for recipient in recipients:
            message = InternalMessage.objects.create(
                sender=request.user, recipient=recipient, content=content, broadcast_id=broadcast_id,
            )
            data = InternalMessageSerializer(message, context={"request": request}).data
            notify_agent(recipient.id, {"event": "internal_message", "message": data})
            created.append(data)

        return Response({"broadcast_id": str(broadcast_id), "recipient_count": len(created)}, status=status.HTTP_201_CREATED)


def models_q_agent_scope(user):
    from django.db.models import Q
    return Q(assigned_agent=user) | Q(assigned_agent__isnull=True, department__in=[user.department, ""])


class GlobalSearchView(APIView):
    """
    Searches across contacts and message content in one go — spec-driven
    by "search inbox, contacts, words, and surface every chat the word
    appears in." Two independent result sets, since they're different
    kinds of matches:

    - customers: name/number matches, same visibility rule as the
      Customers tab (assigned/interacted-with, unless admin-tier+).
    - message_matches: content matches, one entry per matching message,
      each carrying its conversation so the frontend can jump straight
      in. Scoped to conversations the requester can already reach via
      the Inbox (same rule Inbox itself uses) — search surfaces a
      shortcut to existing access, not a way around it.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if not query or len(query) < 2:
            return Response({"customers": [], "message_matches": []})

        from apps.customers.models import Customer
        from apps.customers.serializers import CustomerSerializer

        user = request.user
        customers_qs = Customer.objects.filter(
            Q(name__icontains=query) | Q(whatsapp_number__icontains=query) | Q(account_number__icontains=query)
        )
        if not user.is_admin_tier:
            customers_qs = customers_qs.filter(conversations__assigned_agent=user)
        customers_qs = customers_qs.distinct()[:10]

        messages_qs = Message.objects.filter(content__icontains=query, is_deleted=False).select_related(
            "conversation", "conversation__customer"
        )
        if not user.is_manager_tier:
            # models_q_agent_scope's field names (assigned_agent,
            # department) live on Conversation, one hop from Message —
            # traverse the relationship rather than reusing the Q object
            # as-is, which assumes it's filtering Conversation directly.
            messages_qs = messages_qs.filter(
                Q(conversation__assigned_agent=user)
                | Q(conversation__assigned_agent__isnull=True, conversation__department__in=[user.department, ""])
            )
        messages_qs = messages_qs.order_by("-timestamp")[:20]

        from apps.customers.services.phone_masking import visible_number

        message_matches = [
            {
                "message_id": str(m.id),
                "conversation_id": str(m.conversation_id),
                "customer_name": m.conversation.customer.name,
                "customer_whatsapp_number": visible_number(m.conversation.customer.whatsapp_number, request),
                "snippet": m.content[:160],
                "timestamp": m.timestamp,
            }
            for m in messages_qs
        ]

        return Response({
            "customers": CustomerSerializer(customers_qs, many=True, context={"request": request}).data,
            "message_matches": message_matches,
        })
