"""Interview rounds and scheduled interview sessions."""

from __future__ import annotations

from django.db import models

from core.models import TimeStampedModel


class InterviewRound(TimeStampedModel):
    """A named stage in a job drive's recruitment process.

    Rounds are ordered by ``sequence``; a drive may declare several rounds
    such as "Technical Round 1", "Technical Round 2" and "HR Interview".
    """

    job_drive = models.ForeignKey(
        "placements.JobDrive", on_delete=models.CASCADE, related_name="rounds"
    )
    name = models.CharField(max_length=120)
    sequence = models.PositiveSmallIntegerField(default=1, db_index=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="interview_rounds_created",
    )

    class Meta:
        db_table = "interview_rounds"
        ordering = ["job_drive", "sequence"]
        verbose_name = "Interview round"
        verbose_name_plural = "Interview rounds"
        constraints = [
            models.UniqueConstraint(
                fields=["job_drive", "sequence"], name="uniq_drive_round_sequence"
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.job_drive.title} :: {self.sequence}. {self.name}"


class Interview(TimeStampedModel):
    """A scheduled interview session for a single application."""

    class Mode(models.TextChoices):
        ONLINE = "online", "Online"
        OFFLINE = "offline", "In Person"
        PHONE = "phone", "Phone"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No Show"

    class Outcome(models.TextChoices):
        PENDING = "pending", "Pending"
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"

    application = models.ForeignKey(
        "applications.Application", on_delete=models.CASCADE, related_name="interviews"
    )
    round = models.ForeignKey(
        InterviewRound, on_delete=models.PROTECT, related_name="interviews"
    )
    scheduled_at = models.DateTimeField(db_index=True)
    duration_minutes = models.PositiveSmallIntegerField(default=60)
    mode = models.CharField(max_length=16, choices=Mode.choices, default=Mode.ONLINE)
    venue = models.CharField(max_length=180, blank=True)
    meeting_link = models.URLField(max_length=400, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.SCHEDULED, db_index=True
    )
    outcome = models.CharField(
        max_length=16, choices=Outcome.choices, default=Outcome.PENDING, db_index=True
    )
    feedback = models.TextField(
        blank=True, help_text="Restricted to the recruiting company and the placement cell."
    )
    scheduled_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="interviews_scheduled",
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "interviews"
        ordering = ["scheduled_at"]
        verbose_name = "Interview"
        verbose_name_plural = "Interviews"
        indexes = [
            models.Index(fields=["status", "scheduled_at"], name="interview_status_time_idx"),
            models.Index(fields=["round", "scheduled_at"], name="interview_round_time_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.application_id} @ {self.scheduled_at:%Y-%m-%d %H:%M}"
