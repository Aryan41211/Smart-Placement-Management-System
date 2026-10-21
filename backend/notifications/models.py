"""In-app notifications for users."""

from __future__ import annotations

from django.db import models

from core.models import TimeStampedModel


class Notification(TimeStampedModel):
    """A user facing notification.

    Notifications are always addressed to a single recipient; the API filters
    strictly by the authenticated user so a user can never read another
    account's notifications.
    """

    class Kind(models.TextChoices):
        APPLICATION = "application", "Application"
        SHORTLIST = "shortlist", "Shortlist"
        INTERVIEW = "interview", "Interview"
        RESULT = "result", "Result"
        DRIVE = "drive", "Placement drive"
        ANNOUNCEMENT = "announcement", "Announcement"
        SYSTEM = "system", "System"

    recipient = models.ForeignKey(
        "accounts.User", on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SYSTEM, db_index=True)
    title = models.CharField(max_length=180)
    message = models.TextField()
    link = models.CharField(max_length=300, blank=True, help_text="In-app route to open.")
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"], name="notif_unread_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.recipient_id}: {self.title}"
