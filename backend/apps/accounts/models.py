import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    ADMIN = "ADMIN", "Admin"
    MANAGER = "MANAGER", "Manager"
    AGENT = "AGENT", "Agent"
    SUPPORT = "SUPPORT", "Support"
    SALES = "SALES", "Sales"
    FINANCE = "FINANCE", "Finance"
    VIEWER = "VIEWER", "Viewer"


class User(AbstractUser):
    """
    Custom user model. Email is the login identifier; username is kept
    for Django admin compatibility but is not used for authentication.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=32, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.AGENT)
    department = models.CharField(max_length=50, blank=True)
    is_online = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    class Meta:
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.role})"

    def save(self, *args, **kwargs):
        # Keep the CRM-specific role field consistent with Django's own
        # is_superuser flag, so `createsuperuser` doesn't silently leave
        # someone with role=AGENT (the model default) sitting on full
        # superuser access — every list/filter by role stays accurate.
        if self.is_superuser and self.role != Role.SUPER_ADMIN:
            self.role = Role.SUPER_ADMIN
        super().save(*args, **kwargs)

    @property
    def is_admin_tier(self) -> bool:
        return self.role in {Role.SUPER_ADMIN, Role.ADMIN}

    @property
    def is_manager_tier(self) -> bool:
        return self.role in {Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER}
