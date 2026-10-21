"""Serializers for notifications."""

from __future__ import annotations

from rest_framework import serializers

from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    """Read representation of a notification."""

    class Meta:
        model = Notification
        fields = ("id", "kind", "title", "message", "link", "is_read", "read_at", "created_at")
        read_only_fields = fields


class BroadcastSerializer(serializers.Serializer):
    """Payload used by the placement cell to broadcast an announcement."""

    kind = serializers.ChoiceField(
        choices=Notification.Kind.choices, default=Notification.Kind.ANNOUNCEMENT
    )
    title = serializers.CharField(max_length=180)
    message = serializers.CharField(max_length=2000)
    audience = serializers.ChoiceField(
        choices=[("all", "Everyone"), ("students", "Students"), ("recruiters", "Recruiters")],
        default="all",
    )
