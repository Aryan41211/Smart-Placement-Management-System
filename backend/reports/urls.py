"""URL routing for the reports app."""

from __future__ import annotations

from django.urls import path

from reports import views

app_name = "reports"

urlpatterns = [
    path("dashboard/", views.DashboardView.as_view({"get": "list"}), name="dashboard"),
    path("analytics/", views.AnalyticsView.as_view({"get": "list"}), name="analytics"),
    path("reports/departments/", views.DepartmentStatsView.as_view({"get": "list"}), name="report-departments"),
    path("reports/companies/", views.CompanyStatsView.as_view({"get": "list"}), name="report-companies"),
    path("reports/funnel/", views.FunnelView.as_view({"get": "list"}), name="report-funnel"),
    path("reports/drives/", views.DriveSummaryView.as_view({"get": "list"}), name="report-drives"),
    path("reports/export/", views.ExportView.as_view({"get": "list"}), name="report-export"),
    path("reports/export/students/", views.ExportView.as_view({"get": "export_students"}), name="export-students"),
    path("reports/export/applications/", views.ExportView.as_view({"get": "export_applications"}), name="export-applications"),
    path("reports/export/companies/", views.ExportView.as_view({"get": "export_companies"}), name="export-companies"),
    path("reports/export/drives/", views.ExportView.as_view({"get": "export_drives"}), name="export-drives"),
    path("audit-logs/", views.AuditLogViewSet.as_view({"get": "list"}), name="audit-log-list"),
    path("audit-logs/<int:pk>/", views.AuditLogViewSet.as_view({"get": "retrieve"}), name="audit-log-detail"),
]
