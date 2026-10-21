"""Application submission, duplication and workflow transition tests."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from applications.models import Application, ApplicationStatusHistory
from applications.services import (
    ALLOWED_TRANSITIONS,
    can_transition,
    submit_application,
    transition_application,
)
from notifications.models import Notification

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Submission
# ---------------------------------------------------------------------------
def test_student_can_apply_to_an_eligible_drive(
    student_profile, job_drive, student_user
):
    """An eligible application is created with a history entry."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    assert application.status == Application.Status.APPLIED
    assert application.student == student_profile
    assert application.job_drive == job_drive
    assert ApplicationStatusHistory.objects.filter(application=application).count() == 1


def test_duplicate_application_is_rejected(student_profile, job_drive, student_user):
    """The same student cannot apply twice to the same drive."""
    submit_application(student_profile, job_drive, actor=student_user)
    with pytest.raises(Exception) as excinfo:
        submit_application(student_profile, job_drive, actor=student_user)
    assert "already applied" in str(excinfo.value).lower()


def test_duplicate_application_is_blocked_by_a_database_constraint(
    student_profile, job_drive, student_user
):
    """The database itself prevents a duplicate row."""
    submit_application(student_profile, job_drive, actor=student_user)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Application.objects.create(
                student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
            )


def test_application_to_a_closed_drive_is_rejected(student_profile, closed_drive, student_user):
    """A closed drive rejects new applications."""
    with pytest.raises(Exception) as excinfo:
        submit_application(student_profile, closed_drive, actor=student_user)
    assert "not open" in str(excinfo.value).lower()


def test_application_after_the_deadline_is_rejected(
    student_profile, expired_drive, student_user
):
    """A passed deadline rejects new applications."""
    with pytest.raises(Exception) as excinfo:
        submit_application(student_profile, expired_drive, actor=student_user)
    assert "deadline" in str(excinfo.value).lower()


def test_ineligible_student_cannot_apply(student_profile, job_drive, student_user):
    """The eligibility rules are re-checked on submission."""
    job_drive.min_cgpa = Decimal("9.50")
    job_drive.save(update_fields=["min_cgpa"])
    with pytest.raises(Exception) as excinfo:
        submit_application(student_profile, job_drive, actor=student_user)
    assert "not eligible" in str(excinfo.value).lower()


def test_apply_via_the_api(student_client, student_profile, job_drive):
    """The HTTP endpoint creates the application."""
    response = student_client.post(
        "/api/v1/applications/", {"job_drive": job_drive.pk}, format="json"
    )
    assert response.status_code == 201, response.data
    assert response.json()["status"] == "applied"


def test_apply_via_the_api_rejects_a_duplicate(student_client, student_profile, job_drive):
    """The HTTP endpoint refuses a second application."""
    student_client.post("/api/v1/applications/", {"job_drive": job_drive.pk}, format="json")
    response = student_client.post(
        "/api/v1/applications/", {"job_drive": job_drive.pk}, format="json"
    )
    assert response.status_code == 400
    assert "already applied" in str(response.json()["error"]["message"]).lower()


def test_apply_creates_a_notification(student_profile, job_drive, student_user):
    """The student is notified about the submission."""
    submit_application(student_profile, job_drive, actor=student_user)
    assert Notification.objects.filter(
        recipient=student_user, kind=Notification.Kind.APPLICATION
    ).exists()


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
def test_transition_table_is_explicit():
    """The transition table maps the documented pipeline."""
    assert Application.Status.APPLIED in ALLOWED_TRANSITIONS
    assert Application.Status.SELECTED in ALLOWED_TRANSITIONS
    assert ALLOWED_TRANSITIONS[Application.Status.SELECTED] == set()


def test_can_transition_helper():
    """The helper reflects the transition table."""
    assert can_transition("applied", "under_review") is True
    assert can_transition("selected", "applied") is False
    assert can_transition("rejected", "shortlisted") is False


def test_valid_transition_updates_state_and_history(
    student_profile, job_drive, admin_user, student_user
):
    """A legal transition updates the row and writes a history entry."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    updated = transition_application(
        application,
        Application.Status.UNDER_REVIEW,
        actor=admin_user,
        reason="Screening started",
    )
    assert updated.status == Application.Status.UNDER_REVIEW
    history = ApplicationStatusHistory.objects.filter(application=application).order_by("changed_at")
    assert history.count() == 2
    latest = history.last()
    assert latest.from_status == Application.Status.APPLIED
    assert latest.to_status == Application.Status.UNDER_REVIEW
    assert latest.changed_by == admin_user
    assert latest.reason == "Screening started"


def test_invalid_transition_is_rejected(student_profile, job_drive, admin_user, student_user):
    """A transition that is not in the table is refused."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    with pytest.raises(Exception) as excinfo:
        transition_application(
            application, Application.Status.SELECTED, actor=admin_user
        )
    assert "cannot move" in str(excinfo.value).lower()


def test_terminal_state_cannot_move(student_profile, job_drive, admin_user, student_user):
    """A selected application is final."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    transition_application(application, Application.Status.UNDER_REVIEW, actor=admin_user)
    transition_application(application, Application.Status.SHORTLISTED, actor=admin_user)
    transition_application(application, Application.Status.SELECTED, actor=admin_user)
    with pytest.raises(Exception):
        transition_application(application, Application.Status.REJECTED, actor=admin_user)


def test_student_can_withdraw_their_own_application(
    student_profile, job_drive, student_user
):
    """A student may withdraw their own application."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    updated = transition_application(
        application, Application.Status.WITHDRAWN, actor=student_user
    )
    assert updated.status == Application.Status.WITHDRAWN
    assert updated.withdrawn_at is not None


def test_student_cannot_shortlist_their_own_application(
    student_profile, job_drive, student_user
):
    """A student cannot promote their own application."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    with pytest.raises(Exception) as excinfo:
        transition_application(
            application, Application.Status.SHORTLISTED, actor=student_user
        )
    assert "withdraw" in str(excinfo.value).lower()


def test_student_cannot_touch_another_students_application(
    other_student_profile, job_drive, student_user
):
    """A student cannot transition somebody else's application."""
    application = Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    with pytest.raises(Exception) as excinfo:
        transition_application(
            application, Application.Status.WITHDRAWN, actor=student_user
        )
    assert "own applications" in str(excinfo.value).lower()


def test_recruiter_cannot_touch_another_companys_application(
    recruiter_user, recruiter_profile, other_company, job_drive, student_profile
):
    """A recruiter is scoped to their own company."""
    job_drive.company = other_company
    job_drive.save(update_fields=["company"])
    application = Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    with pytest.raises(Exception) as excinfo:
        transition_application(
            application, Application.Status.SHORTLISTED, actor=recruiter_user
        )
    assert "own company" in str(excinfo.value).lower()


def test_recruiter_can_shortlist_their_own_company_application(
    recruiter_user, recruiter_profile, job_drive, student_profile
):
    """An authorised recruiter can progress their own company's applicants."""
    application = Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    updated = transition_application(
        application, Application.Status.SHORTLISTED, actor=recruiter_user
    )
    assert updated.status == Application.Status.SHORTLISTED
    assert updated.shortlisted_at is not None


def test_status_change_endpoint(auth_client, student_profile, job_drive, student_user):
    """The HTTP endpoint moves an application through the pipeline."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    response = auth_client.post(
        f"/api/v1/applications/{application.pk}/status/",
        {"new_status": "shortlisted", "reason": "Profile reviewed"},
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.json()["status"] == "shortlisted"


def test_status_change_endpoint_rejects_an_invalid_transition(
    auth_client, student_profile, job_drive, student_user
):
    """The HTTP endpoint refuses an illegal transition."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    response = auth_client.post(
        f"/api/v1/applications/{application.pk}/status/",
        {"new_status": "selected"},
        format="json",
    )
    assert response.status_code == 400


def test_history_endpoint_returns_the_trail(
    auth_client, student_profile, job_drive, student_user
):
    """The history endpoint lists every transition."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    response = auth_client.get(f"/api/v1/applications/{application.pk}/history/")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_internal_notes_are_hidden_from_students(
    student_client, student_profile, job_drive, admin_user
):
    """Recruiter-only notes never reach the student payload."""
    application = Application.objects.create(
        student=student_profile,
        job_drive=job_drive,
        status=Application.Status.APPLIED,
        internal_notes="Strong portfolio, hesitant in system design.",
    )
    response = student_client.get(f"/api/v1/applications/{application.pk}/")
    assert response.status_code == 200
    assert "internal_notes" not in response.json()


def test_selected_application_records_the_offer_package(
    student_profile, job_drive, admin_user, student_user
):
    """Selecting a candidate stores the offered package."""
    application = submit_application(student_profile, job_drive, actor=student_user)
    transition_application(application, Application.Status.UNDER_REVIEW, actor=admin_user)
    transition_application(application, Application.Status.SHORTLISTED, actor=admin_user)
    updated = transition_application(
        application,
        Application.Status.SELECTED,
        actor=admin_user,
        offer_package=Decimal("850000.00"),
    )
    assert updated.offer_package == Decimal("850000.00")
    assert updated.selected_at is not None


def test_application_list_is_scoped_to_the_student(
    student_client, student_profile, other_student_profile, job_drive
):
    """A student only receives their own applications."""
    Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status=Application.Status.APPLIED
    )
    response = student_client.get("/api/v1/applications/")
    assert response.status_code == 200
    roll_numbers = {row["student_roll_number"] for row in response.json()["results"]}
    assert roll_numbers == {"SPMS001"}
