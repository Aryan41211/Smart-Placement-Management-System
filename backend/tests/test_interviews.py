"""Interview round, scheduling and outcome tests."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from applications.models import Application
from interviews.models import Interview, InterviewRound
from notifications.models import Notification
from placements.models import JobDrive

pytestmark = pytest.mark.django_db


@pytest.fixture
def application(db, student_profile, job_drive) -> Application:
    """Return an application in the shortlist state."""
    return Application.objects.create(
        student=student_profile, job_drive=job_drive, status=Application.Status.SHORTLISTED
    )


@pytest.fixture
def interview_round(db, job_drive) -> InterviewRound:
    """Return the first technical round of a drive."""
    return InterviewRound.objects.create(
        job_drive=job_drive, name="Technical Round 1", sequence=1
    )


def test_admin_can_create_a_round(auth_client, job_drive):
    """Placement officers define the recruitment rounds of a drive."""
    response = auth_client.post(
        "/api/v1/rounds/",
        {"job_drive": job_drive.pk, "name": "HR Interview", "sequence": 3},
        format="json",
    )
    assert response.status_code == 201, response.data
    assert InterviewRound.objects.filter(job_drive=job_drive, sequence=3).exists()


def test_recruiter_can_create_a_round_for_their_company(
    recruiter_client, recruiter_profile, job_drive
):
    """An authorised recruiter defines rounds for their own drives."""
    response = recruiter_client.post(
        "/api/v1/rounds/",
        {"job_drive": job_drive.pk, "name": "Technical Round 2", "sequence": 2},
        format="json",
    )
    assert response.status_code == 201, response.data


def test_recruiter_cannot_create_a_round_for_another_company(
    recruiter_client, recruiter_profile, job_drive, other_company
):
    """A recruiter cannot touch a drive of a different company."""
    job_drive.company = other_company
    job_drive.save(update_fields=["company"])
    response = recruiter_client.post(
        "/api/v1/rounds/",
        {"job_drive": job_drive.pk, "name": "Technical Round 2", "sequence": 2},
        format="json",
    )
    assert response.status_code == 403


def test_duplicate_round_sequence_is_rejected(auth_client, job_drive, interview_round):
    """The sequence is unique per drive."""
    response = auth_client.post(
        "/api/v1/rounds/",
        {"job_drive": job_drive.pk, "name": "Duplicate", "sequence": 1},
        format="json",
    )
    assert response.status_code == 400


def test_recruiter_can_schedule_an_interview(
    recruiter_client, recruiter_profile, application, interview_round
):
    """Scheduling an interview creates the row and notifies the student."""
    response = recruiter_client.post(
        "/api/v1/interviews/",
        {
            "application": application.pk,
            "round": interview_round.pk,
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "mode": "online",
            "meeting_link": "https://meet.example.invalid/room",
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    assert Interview.objects.filter(application=application).count() == 1
    assert Notification.objects.filter(
        recipient=application.student.user, kind=Notification.Kind.INTERVIEW
    ).exists()


def test_recruiter_cannot_schedule_for_another_company(
    recruiter_client, recruiter_profile, application, interview_round, other_company
):
    """Scheduling is limited to the recruiter's own company."""
    application.job_drive.company = other_company
    application.job_drive.save(update_fields=["company"])
    response = recruiter_client.post(
        "/api/v1/interviews/",
        {
            "application": application.pk,
            "round": interview_round.pk,
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 403


def test_student_cannot_schedule_an_interview(
    student_client, application, interview_round
):
    """Students never create interviews."""
    response = student_client.post(
        "/api/v1/interviews/",
        {
            "application": application.pk,
            "round": interview_round.pk,
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 403


def test_interview_round_must_belong_to_the_application_drive(
    auth_client, application, job_drive, other_company, admin_user
):
    """A round from a different drive cannot be used."""
    other_drive = JobDrive.objects.create(
        title="Other Drive",
        company=other_company,
        role_designation="Analyst",
        application_deadline=timezone.now() + timedelta(days=5),
        status=JobDrive.Status.PUBLISHED,
        created_by=admin_user,
    )
    foreign_round = InterviewRound.objects.create(
        job_drive=other_drive, name="Foreign Round", sequence=1
    )
    response = auth_client.post(
        "/api/v1/interviews/",
        {
            "application": application.pk,
            "round": foreign_round.pk,
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
        },
        format="json",
    )
    assert response.status_code == 400


def test_outcome_can_be_recorded(auth_client, application, interview_round):
    """An outcome moves the interview to completed and stores the feedback."""
    interview = Interview.objects.create(
        application=application,
        round=interview_round,
        scheduled_at=timezone.now() + timedelta(days=1),
    )
    response = auth_client.post(
        f"/api/v1/interviews/{interview.pk}/outcome/",
        {"outcome": "passed", "feedback": "Good problem solving."},
        format="json",
    )
    assert response.status_code == 200, response.data
    interview.refresh_from_db()
    assert interview.outcome == Interview.Outcome.PASSED
    assert interview.status == Interview.Status.COMPLETED
    assert interview.completed_at is not None


def test_student_sees_only_their_own_interviews(
    student_client, application, interview_round, other_student_profile, job_drive
):
    """The interview list is scoped to the authenticated student."""
    Interview.objects.create(
        application=application, round=interview_round, scheduled_at=timezone.now()
    )
    other_application = Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status=Application.Status.SHORTLISTED
    )
    Interview.objects.create(
        application=other_application, round=interview_round, scheduled_at=timezone.now()
    )
    response = student_client.get("/api/v1/interviews/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 1
    assert payload["results"][0]["application"] == application.pk


def test_student_cannot_read_another_students_interview(
    student_client, other_student_profile, job_drive, interview_round
):
    """Object level access protects the interview detail endpoint."""
    other_application = Application.objects.create(
        student=other_student_profile, job_drive=job_drive, status=Application.Status.SHORTLISTED
    )
    interview = Interview.objects.create(
        application=other_application, round=interview_round, scheduled_at=timezone.now()
    )
    response = student_client.get(f"/api/v1/interviews/{interview.pk}/")
    assert response.status_code == 404
