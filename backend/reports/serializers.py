"""Serializers for the reporting and audit-trail endpoints."""

from __future__ import annotations

from rest_framework import serializers

from core.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Read-only representation of a single audit trail entry."""

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_email",
            "action",
            "entity_type",
            "entity_id",
            "description",
            "metadata",
            "ip_address",
            "created_at",
        )
        read_only_fields = fields
