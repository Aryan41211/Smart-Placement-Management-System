"""Django admin registrations for the applications app."""

from __future__ import annotations

from django.contrib import admin

from applications.models import Application, ApplicationStatusHistory


class ApplicationStatusHistoryInline(admin.TabularInline):
    """Read-only inline showing the status trail of an application."""

    model = ApplicationStatusHistory
    extra = 0
    can_delete = False
    readonly_fields = (
        "from_status", "to_status", "changed_by", "changed_by_role", "reason", "changed_at",
    )

    def has_add_permission(self, request, obj=None):
        """Status history is append-only from the admin UI."""
        return False


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    """Admin view for applications."""

    list_display = ("student", "job_drive", "status", "applied_at", "offer_package")
    list_filter = ("status", "job_drive", "job_drive__company")
    search_fields = ("student__roll_number", "student__user__full_name", "job_drive__title")
    list_select_related = ("student", "student__user", "job_drive", "job_drive__company")
    date_hierarchy = "applied_at"
    inlines = [ApplicationStatusHistoryInline]


@admin.register(ApplicationStatusHistory)
class ApplicationStatusHistoryAdmin(admin.ModelAdmin):
    """Admin view for the status trail."""

    list_display = ("application", "from_status", "to_status", "changed_by", "changed_at")
    list_filter = ("to_status",)
    search_fields = ("application__student__roll_number",)
