import uuid

from django.conf import settings
from django.db import models


class CustomerStatus(models.TextChoices):
    LEAD = "LEAD", "Lead"
    ACTIVE = "ACTIVE", "Active"
    SUSPENDED = "SUSPENDED", "Suspended"
    INACTIVE = "INACTIVE", "Inactive"
    PROSPECT = "PROSPECT", "Prospect"


class LeadOutcome(models.TextChoices):
    PENDING = "PENDING", "Pending"
    SUCCESSFUL = "SUCCESSFUL", "Successful"
    REJECTED = "REJECTED", "Rejected"


class Tag(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=50, unique=True)
    color = models.CharField(max_length=7, default="#888880")  # hex
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    whatsapp_number = models.CharField(max_length=20, unique=True, db_index=True)
    name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    location = models.CharField(max_length=200, blank=True)
    account_number = models.CharField(max_length=50, blank=True)
    isp_customer_id = models.CharField(max_length=50, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=CustomerStatus.choices, default=CustomerStatus.LEAD)
    # Distinct from `status` above — this tracks the outcome of working a
    # LEAD specifically (did it convert?), not the customer's overall
    # account state. Meaningful mainly while status=LEAD, but not
    # restricted to it — a lead that goes SUCCESSFUL naturally becomes
    # an ACTIVE customer afterward, and this field just stays as the
    # historical record of how that happened.
    lead_outcome = models.CharField(max_length=20, choices=LeadOutcome.choices, default=LeadOutcome.PENDING)
    # When lead_outcome last actually changed — this is what makes "how
    # many leads did this agent close successfully in March" answerable
    # at all. Without it, we'd only know a lead's CURRENT outcome, not
    # when it got there, which isn't usable for monthly payroll. Kept in
    # sync automatically in save() below, so every code path that
    # changes lead_outcome gets this right, not just the ones that
    # remember to set it explicitly.
    lead_outcome_updated_at = models.DateTimeField(null=True, blank=True)
    # Payment/receipt reference for commission reconciliation — prompted
    # specifically to SALES-role agents when they mark a lead SUCCESSFUL
    # (see the frontend flow), so management has proof of payment to
    # check against before remitting commission. Left blank for anyone
    # else's leads — this isn't a general-purpose field, it exists
    # specifically for that one workflow.
    payment_receipt_number = models.CharField(max_length=100, blank=True)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payment_confirmed_at = models.DateTimeField(null=True, blank=True)
    payment_confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="customers")
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_contact_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_contact_at", "-created_at"]
        indexes = [
            models.Index(fields=["name"]),
            models.Index(fields=["account_number"]),
        ]

    def __str__(self):
        return self.name or self.whatsapp_number

    def save(self, *args, **kwargs):
        if self.pk:
            previous = Customer.objects.filter(pk=self.pk).values_list("lead_outcome", flat=True).first()
            if previous is not None and previous != self.lead_outcome:
                from django.utils import timezone
                self.lead_outcome_updated_at = timezone.now()
        super().save(*args, **kwargs)
