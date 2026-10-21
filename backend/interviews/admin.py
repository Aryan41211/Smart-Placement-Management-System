"""Django admin registrations for the interviews app."""

from __future__ import annotations

from django.contrib import admin

from interviews.models import Interview, InterviewRound


@admin.register(InterviewRound)
class InterviewRoundAdmin(admin.ModelAdmin):
    """Admin view for interview rounds."""

    list_display = ("name", "job_drive", "sequence", "is_active")
    list_filter = ("is_active", "job_drive")
    search_fields = ("name", "job_drive__title")
    list_select_related = ("job_drive",)


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    """Admin view for scheduled interviews."""

    list_display = (
        "application", "round", "scheduled_at", "mode", "status", "outcome",
    )
    list_filter = ("status", "outcome", "mode", "round")
    search_fields = ("application__student__roll_number", "round__name")
    list_select_related = ("application", "round", "round__job_drive")
    date_hierarchy = "scheduled_at"
