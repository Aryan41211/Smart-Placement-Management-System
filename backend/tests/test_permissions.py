"""Role and object level permission tests."""

from __future__ import annotations

import pytest

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_anonymous_access_is_rejected(api_client):
    """Unauthenticated requests never reach a protected endpoint."""
    for url in (
        "/api/v1/dashboard/",
        "/api/v1/students/",
        "/api/v1/drives/",
        "/api/v1/applications/",
        "/api/v1/notifications/",
    ):
        response = api_client.get(url)
        assert response.status_code == 401, url


def test_students_cannot_access_the_admin_directory(student_client):
    """The student directory is restricted to placement officers."""
    response = student_client.get("/api/v1/students/")
    assert response.status_code == 403


def test_recruiters_cannot_access_the_admin_directory(recruiter_client):
    """The student directory is restricted to placement officers."""
    response = recruiter_client.get("/api/v1/students/")
    assert response.status_code == 403


def test_admin_can_access_the_student_directory(auth_client, student_profile):
    """Placement officers can list students."""
    response = auth_client.get("/api/v1/students/")
    assert response.status_code == 200
    assert response.json()["count"] >= 1


def test_students_cannot_create_a_drive(student_client, company):
    """Only placement officers and recruiters create drives."""
    response = student_client.post(
        "/api/v1/drives/",
        {
            "title": "Illegal Drive",
            "company": company.id,
            "role_designation": "Tester",
            "application_deadline": "2099-01-01T00:00:00Z",
        },
        format="json",
    )
    assert response.status_code == 403


def test_students_cannot_create_a_company(student_client):
    """Company records are maintained by the placement cell."""
    response = student_client.post(
        "/api/v1/companies/",
        {"name": "Shadow Corp", "industry": "it_services"},
        format="json",
    )
    assert response.status_code == 403


def test_recruiters_cannot_update_a_company(recruiter_client, company):
    """Only placement officers may edit company records."""
    response = recruiter_client.patch(
        f"/api/v1/companies/{company.pk}/",
        {"location": "Renamed"},
        format="json",
    )
    assert response.status_code == 403


def test_admin_can_create_a_company(auth_client):
    """Placement officers maintain the company directory."""
    response = auth_client.post(
        "/api/v1/companies/",
        {"name": "Fresh Systems", "industry": "it"},
        format="json",
    )
    assert response.status_code == 201, response.data


def test_recruiter_cannot_publish_a_drive(recruiter_client, job_drive):
    """Publication is a placement-officer action."""
    response = recruiter_client.post(f"/api/v1/drives/{job_drive.pk}/publish/")
    assert response.status_code == 403


def test_admin_can_publish_a_drive(auth_client, closed_drive):
    """Publication sets the status and stamps ``published_at``."""
    response = auth_client.post(f"/api/v1/drives/{closed_drive.pk}/publish/")
    assert response.status_code == 200
    closed_drive.refresh_from_db()
    assert closed_drive.status == "published"
    assert closed_drive.published_at is not None


def test_recruiter_cannot_read_another_companys_application(
    recruiter_client, recruiter_profile, other_company, admin_user, job_drive, student_profile
):
    """A recruiter only sees applications for their own company."""
    from applications.models import Application

    drive = job_drive
    drive.company = other_company
    drive.save(update_fields=["company"])
    application = Application.objects.create(
        student=student_profile, job_drive=drive, status="applied"
    )
    response = recruiter_client.get(f"/api/v1/applications/{application.pk}/")
    assert response.status_code == 404


def test_student_cannot_read_another_students_application(
    student_client, other_student_profile, job_drive
):
    """Students only see their own applications."""
    from applications.models import Application

    application = Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status="applied"
    )
    response = student_client.get(f"/api/v1/applications/{application.pk}/")
    assert response.status_code == 404


def test_recruiter_cannot_manage_an_unauthorised_company_drive(
    recruiter_client, recruiter_profile, other_company, admin_user
):
    """An authorised recruiter is still bound to a single company."""
    from placements.models import JobDrive

    drive = JobDrive.objects.create(
        title="Other Company Drive",
        company=other_company,
        role_designation="Tester",
        application_deadline="2099-01-01T00:00:00Z",
        status="published",
        created_by=admin_user,
    )
    response = recruiter_client.patch(
        f"/api/v1/drives/{drive.pk}/", {"title": "Hijacked"}, format="json"
    )
    assert response.status_code in {403, 404}


def test_admin_can_deactivate_a_student_account(auth_client, student_user, student_profile):
    """Placement officers can deactivate and reactivate an account."""
    response = auth_client.post(
        f"/api/v1/students/{student_profile.pk}/",
        {"action": "deactivate"},
        format="json",
    )
    assert response.status_code == 200, response.data
    student_user.refresh_from_db()
    assert student_user.is_active is False

    response = auth_client.post(
        f"/api/v1/students/{student_profile.pk}/",
        {"action": "activate"},
        format="json",
    )
    assert response.status_code == 200
    student_user.refresh_from_db()
    assert student_user.is_active is True


def test_student_cannot_deactivate_another_account(student_client, other_student_profile):
    """Only placement officers may change the account state."""
    response = student_client.post(
        f"/api/v1/students/{other_student_profile.pk}/",
        {"action": "deactivate"},
        format="json",
    )
    assert response.status_code == 403


def test_admin_can_read_a_single_student(auth_client, student_profile):
    """Placement officers can open a student record."""
    response = auth_client.get(f"/api/v1/students/{student_profile.pk}/")
    assert response.status_code == 200
    assert response.json()["roll_number"] == "SPMS001"


def test_role_helper_properties(admin_user, student_user, recruiter_user):
    """The role helpers mirror the stored role."""
    assert admin_user.is_admin is True
    assert admin_user.is_student is False
    assert student_user.is_student is True
    assert recruiter_user.is_recruiter is True
    assert User.objects.get(email=student_user.email).role == User.Role.STUDENT
