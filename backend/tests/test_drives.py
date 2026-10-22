"""Tests for the placement drive API (creation, criteria, lifecycle)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from placements.models import JobDrive, JobDriveSkill

pytestmark = pytest.mark.django_db


def test_admin_can_create_a_drive_with_criteria(auth_client, company, department, skill):
    """Creating a drive with eligible departments and required skills persists both.

    Regression test: the write serializer handed `allowed_departments` (a
    many-to-many field) straight to `JobDrive.objects.create()`, which raised
    `TypeError` and surfaced as HTTP 500 for any client that sent the field.
    """
    payload = {
        "title": "Campus Drive 2027",
        "company": company.id,
        "role_designation": "Graduate Trainee",
        "description": "Entry level role.",
        "job_type": "full_time",
        "drive_mode": "on_campus",
        "package_min": "300000.00",
        "package_max": "500000.00",
        "min_cgpa": "6.00",
        "max_active_backlogs": 1,
        "application_deadline": (timezone.now() + timedelta(days=10)).isoformat(),
        "allowed_departments": [department.id],
        "required_skills": [
            {"skill": skill.id, "requirement_level": "required", "min_proficiency": 2}
        ],
    }

    response = auth_client.post("/api/v1/drives/", payload, format="json")
    assert response.status_code == 201, response.data

    drive = JobDrive.objects.get(pk=response.data["id"])
    assert drive.status == JobDrive.Status.DRAFT
    assert list(drive.allowed_departments.values_list("id", flat=True)) == [department.id]
    assert drive.required_skills.count() == 1
    requirement = drive.required_skills.first()
    assert requirement.requirement_level == JobDriveSkill.Requirement.REQUIRED
    assert requirement.min_proficiency == 2


def test_admin_can_create_a_drive_open_to_every_department(auth_client, company):
    """An empty department list is allowed and means 'open to all'."""
    payload = {
        "title": "Open Drive 2027",
        "company": company.id,
        "role_designation": "Analyst",
        "application_deadline": (timezone.now() + timedelta(days=5)).isoformat(),
        "allowed_departments": [],
        "required_skills": [],
    }
    response = auth_client.post("/api/v1/drives/", payload, format="json")
    assert response.status_code == 201, response.data
    drive = JobDrive.objects.get(pk=response.data["id"])
    assert drive.allowed_departments.count() == 0


def test_admin_can_replace_drive_departments_and_skills(
    auth_client, job_drive, other_department, other_skill
):
    """Updating the criteria replaces the junction rows instead of failing."""
    response = auth_client.patch(
        f"/api/v1/drives/{job_drive.pk}/",
        {
            "allowed_departments": [other_department.id],
            "required_skills": [
                {"skill": other_skill.id, "requirement_level": "required", "min_proficiency": 3}
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data

    job_drive.refresh_from_db()
    assert list(job_drive.allowed_departments.values_list("id", flat=True)) == [
        other_department.id
    ]
    assert list(job_drive.required_skills.values_list("skill__id", flat=True)) == [other_skill.id]


def test_drive_rejects_a_max_package_below_the_minimum(auth_client, company):
    """Cross-field validation is enforced by the serializer."""
    payload = {
        "title": "Bad Range Drive",
        "company": company.id,
        "role_designation": "Analyst",
        "application_deadline": (timezone.now() + timedelta(days=5)).isoformat(),
        "package_min": "900000.00",
        "package_max": "400000.00",
    }
    response = auth_client.post("/api/v1/drives/", payload, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_drive_rejects_a_past_deadline(auth_client, company):
    """A drive cannot be created with a deadline in the past."""
    payload = {
        "title": "Backdated Drive",
        "company": company.id,
        "role_designation": "Analyst",
        "application_deadline": (timezone.now() - timedelta(days=1)).isoformat(),
    }
    response = auth_client.post("/api/v1/drives/", payload, format="json")
    assert response.status_code == 400
