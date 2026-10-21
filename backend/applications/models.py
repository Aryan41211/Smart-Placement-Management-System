"""Application records and the recruitment status history."""

from __future__ import annotations

from django.db import models

from core.models import TimeStampedModel


class Application(TimeStampedModel):
    """A student's application to a job drive.

    The pair ``(student, job_drive)`` is unique, which is the database level
    guarantee against duplicate applications. The lifecycle is enforced by
    :mod:`applications.services`.
    """

    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        UNDER_REVIEW = "under_review", "Under Review"
        SHORTLISTED = "shortlisted", "Shortlisted"
        INTERVIEW = "interview", "Interview"
        SELECTED = "selected", "Selected"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"
        NOT_SELECTED = "not_selected", "Not Selected"

    class TerminalStatus(models.TextChoices):
        SELECTED = "selected", "Selected"
        REJECTED = "rejected", "Rejected"
        WITHDRAWN = "withdrawn", "Withdrawn"
        NOT_SELECTED = "not_selected", "Not Selected"

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="applications"
    )
    job_drive = models.ForeignKey(
        "placements.JobDrive", on_delete=models.CASCADE, related_name="applications"
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.APPLIED, db_index=True
    )
    applied_at = models.DateTimeField(auto_now_add=True, db_index=True)
    status_changed_at = models.DateTimeField(default=None, null=True, blank=True)
    shortlisted_at = models.DateTimeField(null=True, blank=True)
    selected_at = models.DateTimeField(null=True, blank=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    offer_package = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Final offered annual package, in INR.",
    )
    rejection_reason = models.TextField(blank=True)
    internal_notes = models.TextField(
        blank=True, help_text="Recruiter-only notes; never exposed to students."
    )
    eligibility_snapshot = models.JSONField(
        default=dict,
        blank=True,
        help_text="Eligibility criteria captured at submission time for audit purposes.",
    )
    resume_url = models.URLField(max_length=500, blank=True)

    class Meta:
        db_table = "applications"
        ordering = ["-applied_at"]
        verbose_name = "Application"
        verbose_name_plural = "Applications"
        constraints = [
            models.UniqueConstraint(
                fields=["student", "job_drive"], name="uniq_student_drive_application"
            ),
            models.CheckConstraint(
                check=models.Q(offer_package__isnull=True) | models.Q(offer_package__gte=0),
                name="application_offer_package_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["status", "-applied_at"], name="app_status_applied_idx"),
            models.Index(fields=["job_drive", "status"], name="app_drive_status_idx"),
            models.Index(fields=["student", "status"], name="app_student_status_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.student.roll_number} -> {self.job_drive.title} [{self.status}]"

    @property
    def is_terminal(self) -> bool:
        """True when the application has reached a final state."""
        return self.status in {
            self.Status.SELECTED,
            self.Status.REJECTED,
            self.Status.WITHDRAWN,
            self.Status.NOT_SELECTED,
        }

    @property
    def is_placed(self) -> bool:
        """True when the student holds at least one selected offer."""
        return self.status == self.Status.SELECTED


class ApplicationStatusHistory(models.Model):
    """Append-only record of every status transition for an application."""

    application = models.ForeignKey(
        Application, on_delete=models.CASCADE, related_name="status_history"
    )
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, db_index=True)
    changed_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="application_status_changes",
    )
    changed_by_role = models.CharField(max_length=20, blank=True)
    reason = models.CharField(max_length=500, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = "application_status_history"
        ordering = ["-changed_at"]
        verbose_name = "Application status history"
        verbose_name_plural = "Application status history"
        indexes = [
            models.Index(fields=["application", "-changed_at"], name="apphist_app_time_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.application_id}: {self.from_status or '-'} -> {self.to_status}"
