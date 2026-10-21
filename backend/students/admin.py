"""Django admin registrations for the students app."""

from __future__ import annotations

from django.contrib import admin

from students.models import Department


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Admin view for academic departments."""

    list_display = ("code", "name", "annual_intake", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
