import uuid

from django.db import models


class RoutingRule(models.Model):
    """
    Admin-configurable version of the keyword routing in
    apps.conversations.services.routing.KEYWORD_ROUTES. The hard-coded
    defaults ship in v1; this model lets Settings > Routing Rules
    (spec section 13) override/extend them without a deploy.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    keyword = models.CharField(max_length=100)
    department = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=0, help_text="Higher runs first.")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-priority", "keyword"]

    def __str__(self):
        return f'"{self.keyword}" -> {self.department}'


class AutomationRule(models.Model):
    """
    Generic placeholder for scheduled/triggered automations (welcome
    messages, payment reminders, follow-ups — spec section 20). Kept
    deliberately simple for v1: a trigger type + a template to send.
    Execution wiring (Celery beat schedule) is added per-automation as
    each one is implemented, rather than building a generic rule engine
    up front.
    """

    TRIGGER_CHOICES = [
        ("NEW_LEAD", "New lead created"),
        ("PAYMENT_DUE", "Payment due"),
        ("INSTALLATION_SCHEDULED", "Installation scheduled"),
        ("FOLLOW_UP", "Follow-up reminder"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    trigger = models.CharField(max_length=30, choices=TRIGGER_CHOICES)
    template = models.ForeignKey("whatsapp.MessageTemplate", on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Department(models.Model):
    """
    Editable department catalog (Settings > Departments). Conversation.department,
    User.department, and RoutingRule.department all stay plain CharFields
    storing a department `code` — that keeps routing/assignment logic simple
    (compare strings) while this table is what admins actually manage from
    the UI and what populates dropdowns everywhere else.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=20, unique=True, help_text="Short uppercase key, e.g. SALES.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.code = self.code.upper().strip()
        super().save(*args, **kwargs)
