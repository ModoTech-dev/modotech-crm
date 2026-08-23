import uuid

from django.conf import settings
from django.db import models

from apps.customers.models import Customer, Tag


class Department(models.TextChoices):
    """
    Legacy default set — retained only as fallback/default values for
    Conversation.department. The real, admin-editable list of departments
    now lives in apps.automation.models.Department (Settings > Departments);
    this field is a plain string and isn't constrained to these choices.
    """
    SALES = "SALES", "Sales"
    SUPPORT = "SUPPORT", "Support"
    TECHNICAL = "TECHNICAL", "Technical"
    FINANCE = "FINANCE", "Finance"
    INSTALLATION = "INSTALLATION", "Installation"
    GENERAL = "GENERAL", "General"


class ConversationStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    PENDING = "PENDING", "Pending"
    RESOLVED = "RESOLVED", "Resolved"
    CLOSED = "CLOSED", "Closed"


class Priority(models.TextChoices):
    LOW = "LOW", "Low"
    NORMAL = "NORMAL", "Normal"
    HIGH = "HIGH", "High"
    URGENT = "URGENT", "Urgent"


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="conversations")
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_conversations",
    )
    department = models.CharField(max_length=20, default="GENERAL")
    status = models.CharField(max_length=20, choices=ConversationStatus.choices, default=ConversationStatus.OPEN)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.NORMAL)
    subject = models.CharField(max_length=200, blank=True)
    tags = models.ManyToManyField(Tag, blank=True, related_name="conversations")
    last_message_at = models.DateTimeField(null=True, blank=True)
    unread_count = models.PositiveIntegerField(default=0)
    # 24h WhatsApp customer service window — see apps/whatsapp/services/meta_client.py
    service_window_expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "-last_message_at"]),
            models.Index(fields=["assigned_agent", "status"]),
            models.Index(fields=["department", "status"]),
        ]

    def __str__(self):
        return f"Conversation({self.customer}, {self.status})"

    @property
    def within_service_window(self) -> bool:
        from django.utils import timezone
        return bool(self.service_window_expires_at and self.service_window_expires_at > timezone.now())


class SenderType(models.TextChoices):
    CUSTOMER = "CUSTOMER", "Customer"
    AGENT = "AGENT", "Agent"
    SYSTEM = "SYSTEM", "System"
    BOT = "BOT", "Bot"
    # Sent directly from the phone's WhatsApp Business App by whoever
    # physically holds it — NOT through the CRM, so there's no CRM user
    # account to attribute it to. Distinct from AGENT specifically so
    # this is never confused with something a logged-in agent sent
    # through the system; see apps.whatsapp.tasks._process_message_echoes
    # (the smb_message_echoes Coexistence webhook) for where these come
    # from.
    PHONE = "PHONE", "Phone (sent outside the CRM)"


class MessageType(models.TextChoices):
    TEXT = "TEXT", "Text"
    IMAGE = "IMAGE", "Image"
    DOCUMENT = "DOCUMENT", "Document"
    AUDIO = "AUDIO", "Audio"
    VIDEO = "VIDEO", "Video"
    LOCATION = "LOCATION", "Location"
    CONTACT = "CONTACT", "Contact"
    INTERACTIVE = "INTERACTIVE", "Interactive"
    TEMPLATE = "TEMPLATE", "Template"


class MessageStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Received"
    SENT = "SENT", "Sent"
    DELIVERED = "DELIVERED", "Delivered"
    READ = "READ", "Read"
    FAILED = "FAILED", "Failed"


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender_type = models.CharField(max_length=10, choices=SenderType.choices)
    sender_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="sent_messages",
    )
    # Unique per WhatsApp's own message id — required for idempotent webhook
    # processing and status-update correlation.
    whatsapp_message_id = models.CharField(max_length=128, unique=True, null=True, blank=True)
    message_type = models.CharField(max_length=20, choices=MessageType.choices, default=MessageType.TEXT)
    content = models.TextField(blank=True)
    media_path = models.CharField(max_length=500, blank=True)  # storage key, not a public URL
    media_mime_type = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=MessageStatus.choices, default=MessageStatus.RECEIVED)
    timestamp = models.DateTimeField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # "Delete" here only ever means removing it from the CRM's own view —
    # WhatsApp's official Cloud API has no ability to recall a message
    # from the customer's phone once sent, so the underlying content is
    # kept (never hard-deleted) for audit purposes; only the display is
    # suppressed. See the delete_message action on ConversationViewSet
    # for the actual guardrails (agent's own messages only, never a
    # customer's — a CRM shouldn't let staff hide what a customer said).
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["timestamp"]
        indexes = [
            models.Index(fields=["conversation", "timestamp"]),
        ]

    def __str__(self):
        return f"{self.sender_type} message in {self.conversation_id}"


class ConversationAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="assignment_history")
    previous_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    new_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class InternalNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="internal_notes")
    # SET_NULL (not CASCADE) so deleting a user preserves the operational
    # history they left behind — a note about a customer issue shouldn't
    # disappear just because its author's account was later removed.
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class InternalMessage(models.Model):
    """
    Staff-to-staff messaging — entirely separate from customer-facing
    WhatsApp conversations, but able to REFERENCE one via
    referenced_customer, so a colleague can point at "this specific
    client's chat" without pasting a raw link.

    A "message everyone" broadcast (Super Admin only) is implemented as
    one row per recipient, not a single shared record — this is
    deliberate: it means read-status is tracked per person correctly,
    rather than needing to represent "read by some, not others" on one
    ambiguous row. broadcast_id ties the fan-out copies back together
    for anything that later wants to treat them as one event (e.g. a
    "sent to everyone" label, or a future read-count summary).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_internal_messages"
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_internal_messages"
    )
    content = models.TextField(blank=True)  # blank allowed — a message can be just a file, no caption
    file_path = models.CharField(max_length=500, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    file_mime_type = models.CharField(max_length=100, blank=True)
    # Deliberately just a reference, not a data copy — clicking through
    # to the actual conversation still goes through Customer/Conversation
    # access checks exactly as normal, so referencing a customer here
    # never bypasses the visibility scoping built for the Customers tab.
    referenced_customer = models.ForeignKey(
        Customer, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    broadcast_id = models.UUIDField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["sender", "recipient"]),
            models.Index(fields=["recipient", "read_at"]),
        ]
