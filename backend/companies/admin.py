"""Django admin registrations for the companies app."""

from __future__ import annotations

from django.contrib import admin

from companies.models import Company


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    """Admin view for participating companies."""

    list_display = ("name", "industry", "location", "is_active", "created_at")
    list_filter = ("is_active", "industry")
    search_fields = ("name", "location")
    prepopulated_fields = {"slug": ("name",)}
