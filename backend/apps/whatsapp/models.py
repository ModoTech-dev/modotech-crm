import uuid

from django.conf import settings
from django.db import models


class TemplateStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    PENDING = "PENDING", "Pending Meta review"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class MessageTemplate(models.Model):
    """
    Mirrors a WhatsApp message template. `status` tracks Meta's own
    approval state (spec section 17) — templates can only be sent once
    APPROVED. Sync status via a periodic Celery task hitting Meta's
    message_templates endpoint.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    category = models.CharField(max_length=30, default="UTILITY")  # MARKETING | UTILITY | AUTHENTICATION
    language = models.CharField(max_length=10, default="en")
    body = models.TextField(help_text="Use {{variable_name}} placeholders.")
    status = models.CharField(max_length=20, choices=TemplateStatus.choices, default=TemplateStatus.DRAFT)
    meta_template_id = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class BroadcastStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    SENDING = "SENDING", "Sending"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class Broadcast(models.Model):
    """
    A bulk template send to a filtered customer segment (spec section
    12/20 — payment reminders, service notices, etc., generalized into
    one reusable feature rather than a bespoke one per use case).
    Only APPROVED templates can actually be sent — WhatsApp requires
    template messages outside the 24h window, and this is how
    Modotech reaches customers proactively at scale.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    template = models.ForeignKey(MessageTemplate, on_delete=models.PROTECT, related_name="broadcasts")
    # Simple segment filters for v1 — a customer status and/or a tag.
    # Both are optional; leaving both blank targets every customer.
    customer_status_filter = models.CharField(max_length=20, blank=True)
    tag_filter = models.ForeignKey(
        "customers.Tag", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    status = models.CharField(max_length=20, choices=BroadcastStatus.choices, default=BroadcastStatus.DRAFT)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class BroadcastRecipient(models.Model):
    """Per-customer send record — lets a manager see exactly who did/didn't
    get a broadcast and why, instead of just an aggregate count."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    broadcast = models.ForeignKey(Broadcast, on_delete=models.CASCADE, related_name="recipients")
    customer = models.ForeignKey("customers.Customer", on_delete=models.CASCADE, related_name="+")
    status = models.CharField(max_length=20, default="PENDING")
    whatsapp_message_id = models.CharField(max_length=128, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        unique_together = [["broadcast", "customer"]]
