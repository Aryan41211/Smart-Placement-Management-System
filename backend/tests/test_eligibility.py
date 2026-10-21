"""Eligibility engine tests."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from placements.models import JobDrive, JobDriveSkill
from placements.services import evaluate_eligibility

pytestmark = pytest.mark.django_db


def test_eligible_student_passes_every_check(student_profile, job_drive):
    """A student that satisfies all criteria is eligible."""
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is True
    assert result.reasons == []


def test_cgpa_below_minimum_is_reported(student_profile, job_drive):
    """A CGPA below the drive minimum blocks the application."""
    student_profile.cgpa = Decimal("6.50")
    student_profile.save(update_fields=["cgpa"])
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is False
    assert "cgpa_below_minimum" in result.reasons
    assert any("CGPA" in message for message in result.messages)


def test_cgpa_exactly_at_the_minimum_is_eligible(student_profile, job_drive):
    """The minimum CGPA is inclusive."""
    job_drive.min_cgpa = Decimal("8.50")
    job_drive.save(update_fields=["min_cgpa"])
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is True


def test_null_minimum_cgpa_means_no_restriction(student_profile, job_drive):
    """A drive without a CGPA requirement accepts every CGPA."""
    job_drive.min_cgpa = None
    job_drive.save(update_fields=["min_cgpa"])
    student_profile.cgpa = Decimal("5.10")
    student_profile.save(update_fields=["cgpa"])
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is True


def test_department_restriction_is_enforced(
    student_profile, other_student_profile, job_drive, department, other_department
):
    """Only the listed departments may apply."""
    job_drive.allowed_departments.add(department)
    assert evaluate_eligibility(student_profile, job_drive).eligible is True

    result = evaluate_eligibility(other_student_profile, job_drive)
    assert result.eligible is False
    assert "department_not_permitted" in result.reasons


def test_backlog_limit_is_enforced(student_profile, job_drive):
    """Too many active backlogs block the application."""
    job_drive.max_active_backlogs = 0
    job_drive.save(update_fields=["max_active_backlogs"])
    student_profile.active_backlogs = 2
    student_profile.save(update_fields=["active_backlogs"])

    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is False
    assert "backlogs_exceed_limit" in result.reasons


def test_backlog_limit_boundary_is_inclusive(student_profile, job_drive):
    """A student exactly on the backlog limit is still eligible."""
    job_drive.max_active_backlogs = 1
    job_drive.save(update_fields=["max_active_backlogs"])
    student_profile.active_backlogs = 1
    student_profile.save(update_fields=["active_backlogs"])
    assert evaluate_eligibility(student_profile, job_drive).eligible is True


def test_missing_required_skill_is_reported(student_profile, job_drive, skill, other_skill):
    """Required skills must be present on the student's profile."""
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=skill, requirement_level=JobDriveSkill.Requirement.REQUIRED
    )
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=other_skill, requirement_level=JobDriveSkill.Requirement.REQUIRED
    )
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is False
    assert "missing_required_skills" in result.reasons
    assert "Python" in result.messages[0] or "SQL" in result.messages[0]


def test_preferred_skill_never_blocks_an_application(
    student_profile, job_drive, skill, other_skill
):
    """Only REQUIRED skills are blocking."""
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=skill, requirement_level=JobDriveSkill.Requirement.PREFERRED
    )
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=other_skill, requirement_level=JobDriveSkill.Requirement.PREFERRED
    )
    assert evaluate_eligibility(student_profile, job_drive).eligible is True


def test_fulfilled_skill_requirement_passes(
    student_profile, job_drive, skill, student_skill
):
    """A skill present on the profile satisfies the requirement."""
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=skill, requirement_level=JobDriveSkill.Requirement.REQUIRED
    )
    assert evaluate_eligibility(student_profile, job_drive).eligible is True


def test_closed_drive_is_not_open_for_applications(student_profile, closed_drive):
    """A closed drive never accepts applications."""
    result = evaluate_eligibility(student_profile, closed_drive)
    assert result.eligible is False
    assert "drive_not_published" in result.reasons


def test_expired_deadline_is_reported(student_profile, expired_drive):
    """A passed deadline blocks the application."""
    result = evaluate_eligibility(student_profile, expired_drive)
    assert result.eligible is False
    assert "deadline_passed" in result.reasons


def test_graduation_year_window_is_enforced(student_profile, job_drive):
    """Students outside the graduation window are not eligible."""
    job_drive.min_graduation_year = 2027
    job_drive.max_graduation_year = 2028
    job_drive.save(update_fields=["min_graduation_year", "max_graduation_year"])
    result = evaluate_eligibility(student_profile, job_drive)
    assert result.eligible is False
    assert "graduation_year_not_eligible" in result.reasons


def test_eligibility_endpoint_for_student(student_client, student_profile, job_drive):
    """The eligibility endpoint returns the decision for the caller."""
    response = student_client.get(f"/api/v1/drives/{job_drive.pk}/eligibility/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eligible"] is True
    assert payload["reasons"] == []


def test_eligibility_endpoint_reports_ineligibility(
    student_client, student_profile, job_drive
):
    """The endpoint explains why a student is not eligible."""
    student_profile.cgpa = Decimal("5.00")
    student_profile.save(update_fields=["cgpa"])
    response = student_client.get(f"/api/v1/drives/{job_drive.pk}/eligibility/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["eligible"] is False
    assert "cgpa_below_minimum" in payload["reasons"]


def test_eligibility_endpoint_allows_admin_to_check_a_student(
    auth_client, student_profile, job_drive
):
    """Placement officers can evaluate another student's eligibility."""
    response = auth_client.get(
        f"/api/v1/drives/{job_drive.pk}/eligibility/?student_id={student_profile.pk}"
    )
    assert response.status_code == 200
    assert response.json()["eligible"] is True


def test_eligibility_is_reevaluated_when_the_drive_closes(
    student_profile, job_drive
):
    """Eligibility changes as soon as the drive is closed."""
    assert evaluate_eligibility(student_profile, job_drive).eligible is True
    job_drive.status = JobDrive.Status.CLOSED
    job_drive.save(update_fields=["status"])
    assert evaluate_eligibility(student_profile, job_drive).eligible is False


def test_deadline_in_the_future_is_accepted(student_profile, job_drive):
    """A deadline in the future keeps the drive open."""
    job_drive.application_deadline = timezone.now() + timedelta(hours=1)
    job_drive.save(update_fields=["application_deadline"])
    assert evaluate_eligibility(student_profile, job_drive).eligible is True
