"""Core models shared across the placement applications."""

from __future__ import annotations

from django.conf import settings
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base providing ``created_at`` / ``updated_at`` timestamps."""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditLog(TimeStampedModel):
    """Immutable audit trail for significant administrative changes.

    Every row records *who* performed *what* on *which* entity and *when*.
    Rows are append-only from the application's point of view - the API never
    exposes update or delete endpoints for this model.
    """

    class Action(models.TextChoices):
        CREATE = "create", "Create"
        UPDATE = "update", "Update"
        DELETE = "delete", "Delete"
        STATUS_CHANGE = "status_change", "Status change"
        LOGIN = "login", "Login"
        LOGOUT = "logout", "Logout"
        EXPORT = "export", "Export"
        APPROVE = "approve", "Approve"
        PUBLISH = "publish", "Publish"
        CLOSE = "close", "Close"
        CANCEL = "cancel", "Cancel"

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    actor_email = models.CharField(
        max_length=254,
        blank=True,
        help_text="Denormalised snapshot so the trail survives account deletion.",
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    entity_type = models.CharField(max_length=64, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)
    description = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        verbose_name = "Audit log"
        verbose_name_plural = "Audit logs"
        indexes = [
            models.Index(fields=["entity_type", "entity_id"], name="audit_entity_idx"),
            models.Index(fields=["action", "-created_at"], name="audit_action_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.actor_email} {self.action} {self.entity_type}"
