"""Django admin registrations for the notifications app."""

from __future__ import annotations

from django.contrib import admin

from notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin view for notifications."""

    list_display = ("title", "recipient", "kind", "is_read", "created_at")
    list_filter = ("kind", "is_read")
    search_fields = ("title", "recipient__email", "recipient__full_name")
    list_select_related = ("recipient",)
