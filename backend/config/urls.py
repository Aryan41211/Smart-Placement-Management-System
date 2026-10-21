"""Root URL configuration.

All application APIs are versioned under ``/api/v1/``.
"""

from __future__ import annotations

from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def api_root(request):
    """Return a short description of the available API namespaces."""
    return JsonResponse(
        {
            "service": "Smart Placement Management System",
            "version": "v1",
            "endpoints": [
                "api/v1/health/",
                "api/v1/auth/",
                "api/v1/students/",
                "api/v1/skills/",
                "api/v1/companies/",
                "api/v1/recruiters/",
                "api/v1/drives/",
                "api/v1/applications/",
                "api/v1/my-applications/",
                "api/v1/application-summary/",
                "api/v1/rounds/",
                "api/v1/interviews/",
                "api/v1/my-interviews/",
                "api/v1/notifications/",
                "api/v1/dashboard/",
                "api/v1/analytics/",
                "api/v1/reports/",
                "api/v1/audit-logs/",
            ],
        }
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", include("core.urls")),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/students/", include("students.urls")),
    path("api/v1/skills/", include("students.skills_urls")),
    path("api/v1/", include("companies.urls")),
    path("api/v1/", include("companies.recruiters_urls")),
    path("api/v1/", include("placements.urls")),
    path("api/v1/", include("applications.urls")),
    path("api/v1/", include("interviews.rounds_urls")),
    path("api/v1/", include("interviews.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("reports.urls")),
    path("api/", api_root, name="api-root"),
]
