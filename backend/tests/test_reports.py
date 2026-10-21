"""Dashboard, analytics, CSV export and audit trail tests."""

from __future__ import annotations

import csv
import io

import pytest
from django.utils import timezone

from applications.models import Application
from core.models import AuditLog
from placements.models import JobDrive

pytestmark = pytest.mark.django_db


def test_admin_dashboard_counts_from_the_database(
    auth_client, student_profile, company, job_drive
):
    """The dashboard aggregates real rows."""
    response = auth_client.get("/api/v1/dashboard/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["role"] == "admin"
    assert payload["total_students"] == 1
    assert payload["total_companies"] == 1
    assert payload["active_drives"] == 1
    assert payload["total_applications"] == 0


def test_admin_dashboard_counts_placements(auth_client, student_profile, job_drive):
    """A selected application counts as a placement."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SELECTED
    )
    payload = auth_client.get("/api/v1/dashboard/").json()
    assert payload["placed_students"] == 1
    assert payload["unplaced_students"] == 0
    assert payload["placement_rate"] == 100.0


def test_student_dashboard_is_scoped_to_the_student(
    student_client, student_profile, other_student_profile, job_drive
):
    """The student dashboard only counts the caller's own applications."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    payload = student_client.get("/api/v1/dashboard/").json()
    assert payload["role"] == "student"
    assert payload["total_applications"] == 1
    assert payload["applications_in_progress"] == 1


def test_student_dashboard_counts_eligible_drives(student_client, student_profile, job_drive):
    """An eligible, open drive is counted."""
    payload = student_client.get("/api/v1/dashboard/").json()
    assert payload["eligible_drives"] == 1
    assert job_drive.pk in payload["eligible_drive_ids"]


def test_recruiter_dashboard_is_scoped_to_the_company(
    recruiter_client, recruiter_profile, student_profile, job_drive
):
    """The recruiter dashboard counts only their own drives."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SHORTLISTED
    )
    payload = recruiter_client.get("/api/v1/dashboard/").json()
    assert payload["role"] == "recruiter"
    assert payload["total_applicants"] == 1
    assert payload["shortlisted"] == 1
    assert payload["active_drives"] == 1


def test_department_statistics(auth_client, student_profile, job_drive, department):
    """Department-wise statistics are computed in the database."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SELECTED
    )
    response = auth_client.get("/api/v1/reports/departments/")
    assert response.status_code == 200
    rows = response.json()
    assert rows[0]["student_count"] == 1
    assert rows[0]["placed_count"] == 1
    assert rows[0]["placement_rate"] == 100.0


def test_company_statistics(auth_client, student_profile, job_drive, company):
    """Company-wise statistics are computed in the database."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SELECTED
    )
    response = auth_client.get("/api/v1/reports/companies/")
    assert response.status_code == 200
    rows = response.json()
    assert rows[0]["company_name"] == company.name
    assert rows[0]["selected_count"] == 1


def test_application_funnel(auth_client, student_profile, job_drive):
    """The funnel lists every status with its count."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    response = auth_client.get("/api/v1/reports/funnel/")
    assert response.status_code == 200
    rows = {row["status"]: row["count"] for row in response.json()}
    assert rows["applied"] == 1
    assert rows["selected"] == 0


def test_csv_export_requires_admin(student_client):
    """A student cannot export the student directory."""
    response = student_client.get("/api/v1/reports/export/students/")
    assert response.status_code == 403


def test_csv_export_returns_a_csv_document(auth_client, student_profile):
    """An administrator receives a downloadable CSV file."""
    response = auth_client.get("/api/v1/reports/export/students/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    assert "attachment" in response["Content-Disposition"]
    rows = list(csv.reader(io.StringIO(response.content.decode())))
    assert rows[0][0] == "Roll Number"
    assert len(rows) == 2


def test_csv_export_of_applications(auth_client, student_profile, job_drive):
    """The application register export contains the submitted applications."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    response = auth_client.get("/api/v1/reports/export/applications/")
    assert response.status_code == 200
    rows = list(csv.reader(io.StringIO(response.content.decode())))
    assert len(rows) == 2


def test_audit_log_is_written_for_publishing(auth_client, closed_drive):
    """Publishing a drive creates an audit entry."""
    auth_client.post(f"/api/v1/drives/{closed_drive.pk}/publish/")
    entry = AuditLog.objects.filter(entity_type="JobDrive", entity_id=str(closed_drive.pk)).first()
    assert entry is not None
    assert entry.action == AuditLog.Action.PUBLISH


def test_audit_log_endpoint_requires_admin(auth_client, student_client, admin_user):
    """Only placement officers can read the audit trail."""
    assert student_client.get("/api/v1/audit-logs/").status_code == 403
    response = auth_client.get("/api/v1/audit-logs/")
    assert response.status_code == 200
    assert "results" in response.json()


def test_audit_log_lists_the_recorded_entries(auth_client, closed_drive, admin_user):
    """The audit trail is returned newest first."""
    auth_client.post(f"/api/v1/drives/{closed_drive.pk}/publish/")
    response = auth_client.get("/api/v1/audit-logs/")
    entries = response.json()["results"]
    assert entries
    assert entries[0]["action"] == "publish"
    assert entries[0]["entity_type"] == "JobDrive"


def test_analytics_endpoint(auth_client, student_profile, job_drive):
    """The analytics endpoint returns the reporting payload."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SELECTED
    )
    response = auth_client.get("/api/v1/analytics/")
    assert response.status_code == 200
    payload = response.json()
    assert "departments" in payload
    assert "companies" in payload
    assert "funnel" in payload
    assert "recent_activity" in payload
