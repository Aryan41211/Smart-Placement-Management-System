"""Dashboard, analytics, CSV export and audit trail endpoints."""

from __future__ import annotations

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import StudentProfile, User
from applications.models import Application
from core.models import AuditLog
from core.permissions import IsAdmin
from placements.models import JobDrive
from reports import services
from reports.csv import csv_response


class DashboardView(viewsets.ViewSet):
    """``GET /api/v1/dashboard/`` - role aware dashboard payload."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return the dashboard metrics for the authenticated role."""
        if request.user.is_admin:
            payload = services.admin_dashboard()
            payload["role"] = User.Role.ADMIN
        elif request.user.is_recruiter:
            payload = services.recruiter_dashboard(request.user)
            payload["role"] = User.Role.RECRUITER
        else:
            student = StudentProfile.objects.filter(user=request.user).first()
            if student is None:
                return Response(
                    {
                        "error": {
                            "code": "not_found",
                            "message": "No student profile is linked to this account.",
                        }
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )
            payload = services.student_dashboard(student)
            payload["role"] = User.Role.STUDENT
        return Response(payload, status=status.HTTP_200_OK)


class AnalyticsView(viewsets.ViewSet):
    """Aggregated analytics used by the reporting screens."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return department, company, funnel and package analytics."""
        user = request.user
        if user.is_admin:
            payload = {
                "departments": services.department_placement_stats(),
                "companies": services.company_recruitment_stats(),
                "funnel": services.application_funnel(),
                "top_recruiters": services.top_recruiters(),
                "packages": services.package_statistics(),
                "drives": services.drive_summary(),
            }
        elif user.is_recruiter:
            payload = services.recruiter_analytics(user)
        else:
            payload = {
                "funnel": [],
                "packages": services.package_statistics(),
            }
        payload["recent_activity"] = services.recent_activity(limit=8)
        return Response(payload, status=status.HTTP_200_OK)


class DepartmentStatsView(viewsets.ViewSet):
    """``GET /api/v1/reports/departments/`` - department-wise statistics."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def list(self, request, *args, **kwargs):
        """Return the department-wise placement statistics."""
        return Response(services.department_placement_stats(), status=status.HTTP_200_OK)


class CompanyStatsView(viewsets.ViewSet):
    """``GET /api/v1/reports/companies/`` - company-wise statistics."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def list(self, request, *args, **kwargs):
        """Return the company-wise recruitment statistics."""
        return Response(services.company_recruitment_stats(), status=status.HTTP_200_OK)


class FunnelView(viewsets.ViewSet):
    """``GET /api/v1/reports/funnel/`` - the application funnel."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return the application funnel counts."""
        return Response(services.application_funnel(), status=status.HTTP_200_OK)


class DriveSummaryView(viewsets.ViewSet):
    """``GET /api/v1/reports/drives/`` - drive-wise recruitment summary."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return the drive summary, scoped to the caller's company."""
        rows = services.drive_summary()
        if not request.user.is_admin:
            profile = getattr(request.user, "recruiter_profile", None)
            company_id = getattr(profile, "company_id", None)
            rows = services.drive_summary(company_id=company_id) if company_id else []
        return Response(rows, status=status.HTTP_200_OK)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """``/api/v1/audit-logs/`` - the administrative audit trail."""

    permission_classes = [IsAuthenticated, IsAdmin]
    serializer_class = None
    filterset_fields = ["action", "entity_type"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    search_fields = ["actor_email", "description", "entity_type", "entity_id"]

    def get_queryset(self):
        """Return the audit trail."""
        return AuditLog.objects.select_related("actor")

    def list(self, request, *args, **kwargs):
        """Return a paginated list of audit entries."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        data = [
            {
                "id": entry.id,
                "actor_email": entry.actor_email,
                "action": entry.action,
                "entity_type": entry.entity_type,
                "entity_id": entry.entity_id,
                "description": entry.description,
                "metadata": entry.metadata,
                "ip_address": entry.ip_address,
                "created_at": entry.created_at.isoformat(),
            }
            for entry in (page if page is not None else queryset)
        ]
        if page is not None:
            return self.get_paginated_response(data)
        return Response(data, status=status.HTTP_200_OK)


class ExportView(viewsets.ViewSet):
    """CSV exports for the authorised administrative reports."""

    permission_classes = [IsAuthenticated, IsAdmin]

    def _students(self, request) -> HttpResponse:
        """Export the student directory with placement outcomes."""
        queryset = (
            StudentProfile.objects.select_related("user", "department")
            .annotate(
                application_count=Count("applications", distinct=True),
                placed=Count(
                    "applications",
                    filter=Q(applications__status=Application.Status.SELECTED),
                    distinct=True,
                ),
            )
            .order_by("roll_number")
        )
        department = request.query_params.get("department")
        if department:
            queryset = queryset.filter(department_id=department)
        headers = [
            "Roll Number",
            "Name",
            "Email",
            "Department",
            "CGPA",
            "Active Backlogs",
            "Graduation Year",
            "Applications",
            "Placed",
        ]
        rows = [
            [
                profile.roll_number,
                profile.user.full_name,
                profile.user.email,
                profile.department.name,
                profile.cgpa,
                profile.active_backlogs,
                profile.graduation_year,
                profile.application_count,
                "Yes" if profile.placed else "No",
            ]
            for profile in queryset
        ]
        return csv_response("students.csv", headers, rows)

    def _applications(self, request) -> HttpResponse:
        """Export the application register."""
        queryset = (
            Application.objects.select_related(
                "student__user", "student__department", "job_drive__company"
            )
            .order_by("-applied_at")
        )
        status_filter = request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        company = request.query_params.get("company")
        if company:
            queryset = queryset.filter(job_drive__company_id=company)
        headers = [
            "Application ID",
            "Roll Number",
            "Student",
            "Department",
            "CGPA",
            "Company",
            "Drive",
            "Status",
            "Applied At",
            "Offer Package",
        ]
        rows = [
            [
                application.id,
                application.student.roll_number,
                application.student.user.full_name,
                application.student.department.name,
                application.student.cgpa,
                application.job_drive.company.name,
                application.job_drive.title,
                application.get_status_display(),
                application.applied_at.isoformat(),
                application.offer_package if application.offer_package is not None else "",
            ]
            for application in queryset
        ]
        return csv_response("applications.csv", headers, rows)

    def _companies(self, request) -> HttpResponse:
        """Export the company-wise recruitment statistics."""
        headers = [
            "Company",
            "Industry",
            "Drives",
            "Applicants",
            "Selected",
            "Selection Rate (%)",
        ]
        rows = [
            [
                row["company_name"],
                row["industry"],
                row["drive_count"],
                row["applicant_count"],
                row["selected_count"],
                row["selection_rate"],
            ]
            for row in services.company_recruitment_stats()
        ]
        return csv_response("company_statistics.csv", headers, rows)

    def _drives(self, request) -> HttpResponse:
        """Export the drive-wise recruitment summary."""
        headers = [
            "Drive",
            "Company",
            "Status",
            "Deadline",
            "Applications",
            "Shortlisted",
            "Selected",
        ]
        rows = [
            [
                row["title"],
                row["company"],
                row["status"],
                row["deadline"],
                row["application_count"],
                row["shortlisted_count"],
                row["selected_count"],
            ]
            for row in services.drive_summary()
        ]
        return csv_response("drive_summary.csv", headers, rows)

    def list(self, request, *args, **kwargs):
        """Return the list of available CSV exports."""
        return Response(
            {
                "exports": [
                    {"key": "students", "label": "Student directory", "filename": "students.csv"},
                    {"key": "applications", "label": "Application register", "filename": "applications.csv"},
                    {"key": "companies", "label": "Company statistics", "filename": "company_statistics.csv"},
                    {"key": "drives", "label": "Drive summary", "filename": "drive_summary.csv"},
                ]
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="students")
    def export_students(self, request, *args, **kwargs):
        """``GET /api/v1/reports/export/students/`` - student directory CSV."""
        return self._students(request)

    @action(detail=False, methods=["get"], url_path="applications")
    def export_applications(self, request, *args, **kwargs):
        """``GET /api/v1/reports/export/applications/`` - application register CSV."""
        return self._applications(request)

    @action(detail=False, methods=["get"], url_path="companies")
    def export_companies(self, request, *args, **kwargs):
        """``GET /api/v1/reports/export/companies/`` - company statistics CSV."""
        return self._companies(request)

    @action(detail=False, methods=["get"], url_path="drives")
    def export_drives(self, request, *args, **kwargs):
        """``GET /api/v1/reports/export/drives/`` - drive summary CSV."""
        return self._drives(request)
