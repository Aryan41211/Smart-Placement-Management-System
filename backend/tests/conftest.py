"""Shared pytest fixtures for the Smart Placement Management System test suite.

The suite runs against the project's real MySQL configuration. pytest-django
creates and drops a dedicated ``test_placement_management`` database; the
development database is never touched.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import RecruiterProfile, StudentProfile, User
from companies.models import Company
from placements.models import JobDrive, JobDriveSkill, Skill, StudentSkill
from students.models import Department

PASSWORD = "TestPassw0rd!"


@pytest.fixture
def api_client() -> APIClient:
    """Return an unauthenticated API client."""
    return APIClient()


@pytest.fixture
def department(db) -> Department:
    """Return a Computer Science department."""
    department, _ = Department.objects.get_or_create(
        code="CSE", defaults={"name": "Computer Science and Engineering"}
    )
    return department


@pytest.fixture
def other_department(db) -> Department:
    """Return a Mechanical Engineering department."""
    department, _ = Department.objects.get_or_create(
        code="ME", defaults={"name": "Mechanical Engineering"}
    )
    return department


@pytest.fixture
def admin_user(db) -> User:
    """Return an active placement officer account."""
    return User.objects.create_user(
        email="officer@test.invalid",
        password=PASSWORD,
        full_name="Placement Officer",
        role=User.Role.ADMIN,
        is_staff=True,
    )


@pytest.fixture
def student_user(db) -> User:
    """Return an active student account."""
    return User.objects.create_user(
        email="student@test.invalid",
        password=PASSWORD,
        full_name="Test Student",
        role=User.Role.STUDENT,
    )


@pytest.fixture
def other_student_user(db) -> User:
    """Return a second active student account."""
    return User.objects.create_user(
        email="student2@test.invalid",
        password=PASSWORD,
        full_name="Other Student",
        role=User.Role.STUDENT,
    )


@pytest.fixture
def recruiter_user(db) -> User:
    """Return an active recruiter account without a company."""
    return User.objects.create_user(
        email="recruiter@test.invalid",
        password=PASSWORD,
        full_name="Test Recruiter",
        role=User.Role.RECRUITER,
    )


@pytest.fixture
def company(db) -> Company:
    """Return an active recruiting company."""
    company, _ = Company.objects.get_or_create(
        name="Acme Systems", defaults={"industry": Company.Industry.INFORMATION_TECHNOLOGY}
    )
    return company


@pytest.fixture
def other_company(db) -> Company:
    """Return a second recruiting company."""
    company, _ = Company.objects.get_or_create(
        name="Globex Corp", defaults={"industry": Company.Industry.IT_SERVICES}
    )
    return company


@pytest.fixture
def recruiter_profile(db, recruiter_user, company) -> RecruiterProfile:
    """Return an authorised recruiter profile bound to ``company``."""
    profile = RecruiterProfile.objects.create(
        user=recruiter_user, company=company, is_authorized=True, can_post_jobs=True
    )
    return profile


@pytest.fixture
def student_profile(db, student_user, department) -> StudentProfile:
    """Return a student profile with strong academics."""
    profile = StudentProfile.objects.create(
        user=student_user,
        roll_number="SPMS001",
        department=department,
        cgpa=Decimal("8.50"),
        active_backlogs=0,
        graduation_year=2026,
        current_semester=7,
    )
    return profile


@pytest.fixture
def other_student_profile(db, other_student_user, other_department) -> StudentProfile:
    """Return a second student profile in a different department."""
    profile = StudentProfile.objects.create(
        user=other_student_user,
        roll_number="SPMS002",
        department=other_department,
        cgpa=Decimal("7.20"),
        active_backlogs=1,
        graduation_year=2026,
        current_semester=7,
    )
    return profile


@pytest.fixture
def skill(db) -> Skill:
    """Return a skill tag."""
    skill, _ = Skill.objects.get_or_create(name="Python", defaults={"category": "Programming"})
    return skill


@pytest.fixture
def other_skill(db) -> Skill:
    """Return a second skill tag."""
    skill, _ = Skill.objects.get_or_create(name="SQL", defaults={"category": "Data"})
    return skill


@pytest.fixture
def student_skill(db, student_profile, skill) -> StudentSkill:
    """Attach a skill to the student profile."""
    return StudentSkill.objects.create(student=student_profile, skill=skill, proficiency_level=4)


@pytest.fixture
def job_drive(db, company, admin_user) -> JobDrive:
    """Return a published, open placement drive."""
    drive = JobDrive.objects.create(
        title="Software Engineer",
        company=company,
        role_designation="Software Engineer",
        description="Backend engineering role.",
        package_min=Decimal("500000.00"),
        package_max=Decimal("900000.00"),
        min_cgpa=Decimal("7.00"),
        max_active_backlogs=1,
        application_deadline=timezone.now() + timedelta(days=10),
        status=JobDrive.Status.PUBLISHED,
        published_at=timezone.now(),
        created_by=admin_user,
    )
    return drive


@pytest.fixture
def drive_with_requirements(
    db, job_drive, department, skill, other_skill
) -> JobDrive:
    """Return a drive restricted to one department and two required skills."""
    job_drive.allowed_departments.add(department)
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=skill, requirement_level=JobDriveSkill.Requirement.REQUIRED
    )
    JobDriveSkill.objects.create(
        job_drive=job_drive, skill=other_skill, requirement_level=JobDriveSkill.Requirement.REQUIRED
    )
    return job_drive


@pytest.fixture
def closed_drive(db, company, admin_user) -> JobDrive:
    """Return a closed placement drive."""
    return JobDrive.objects.create(
        title="Closed Drive",
        company=company,
        role_designation="Analyst",
        application_deadline=timezone.now() + timedelta(days=5),
        status=JobDrive.Status.CLOSED,
        created_by=admin_user,
    )


@pytest.fixture
def expired_drive(db, company, admin_user) -> JobDrive:
    """Return a published drive whose deadline has already passed."""
    return JobDrive.objects.create(
        title="Expired Drive",
        company=company,
        role_designation="Analyst",
        application_deadline=timezone.now() - timedelta(days=1),
        status=JobDrive.Status.PUBLISHED,
        published_at=timezone.now() - timedelta(days=10),
        created_by=admin_user,
    )


@pytest.fixture
def auth_client(admin_user) -> APIClient:
    """Return an API client authenticated as the placement officer."""
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(student_user) -> APIClient:
    """Return an API client authenticated as the student."""
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def recruiter_client(recruiter_user) -> APIClient:
    """Return an API client authenticated as the recruiter."""
    client = APIClient()
    client.force_authenticate(user=recruiter_user)
    return client
