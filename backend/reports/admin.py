"""Django admin registrations for the reports app (audit trail)."""

from __future__ import annotations

from django.contrib import admin

from core.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    """Admin view for the audit trail."""

    list_display = ("created_at", "actor_email", "action", "entity_type", "entity_id", "description")
    list_filter = ("action", "entity_type")
    search_fields = ("actor_email", "entity_type", "entity_id", "description")
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        """Audit rows are written by the application only."""
        return False

    def has_change_permission(self, request, obj=None):
        """Audit rows are immutable."""
        return False
