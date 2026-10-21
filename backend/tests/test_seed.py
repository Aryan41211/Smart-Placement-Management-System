"""Integration tests for the `seed_demo_data` management command.

These tests protect the demonstration dataset that the viva and the demo guide
rely on. They run against the same MySQL server as the rest of the suite; the
data is created inside the per-test transaction and rolled back afterwards.
"""

from __future__ import annotations

import pytest
from django.core.management import call_command

from accounts.models import RecruiterProfile, StudentProfile
from applications.models import Application, ApplicationStatusHistory
from companies.models import Company
from placements.models import JobDrive, JobDriveSkill, StudentSkill
from students.models import Department

pytestmark = pytest.mark.django_db

SEED_PASSWORD = "SeedPassw0rd!"


@pytest.fixture
def seeded(db):
    """Populate the demonstration dataset once for the test."""
    call_command("seed_demo_data", "--password", SEED_PASSWORD, verbosity=0)


def test_seed_creates_the_expected_dataset(seeded):
    """The seeder produces every entity the demo guide references."""
    assert Department.objects.count() >= 3
    assert StudentProfile.objects.count() >= 15
    assert Company.objects.count() >= 3
    assert JobDrive.objects.count() >= 4
    assert JobDriveSkill.objects.exists()
    assert StudentSkill.objects.exists()
    assert Application.objects.count() >= 5
    assert RecruiterProfile.objects.filter(is_authorized=True).exists()


def test_seed_is_idempotent(seeded):
    """Running the command twice never duplicates rows."""
    before = (
        StudentProfile.objects.count(),
        Company.objects.count(),
        JobDrive.objects.count(),
        Application.objects.count(),
        ApplicationStatusHistory.objects.count(),
    )

    call_command("seed_demo_data", "--password", SEED_PASSWORD, verbosity=0)

    after = (
        StudentProfile.objects.count(),
        Company.objects.count(),
        JobDrive.objects.count(),
        Application.objects.count(),
        ApplicationStatusHistory.objects.count(),
    )
    assert before == after


def test_every_application_records_its_opening_history_row(seeded):
    """Each application carries the `'' -> applied` row the API writes.

    Regression test: an earlier revision of the seeder inserted applications
    directly and skipped the opening history entry, so the UI showed an empty
    status trail for freshly applied records.
    """
    assert Application.objects.filter(status_history__isnull=True).count() == 0
    opening_rows = ApplicationStatusHistory.objects.filter(from_status="").count()
    assert opening_rows == Application.objects.count()


def test_seed_covers_several_pipeline_statuses(seeded):
    """The demo dataset is only useful if it shows more than one status."""
    statuses = set(Application.objects.values_list("status", flat=True))
    assert len(statuses) >= 3


def test_seed_has_no_orphan_applications(seeded):
    """Referential integrity holds after seeding."""
    assert Application.objects.filter(student__isnull=True).count() == 0
    assert Application.objects.filter(job_drive__isnull=True).count() == 0
