"""Placement drive, skill taxonomy and their junction models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from core.models import TimeStampedModel


class Skill(models.Model):
    """A reusable skill tag (e.g. "Python", "SQL", "React")."""

    name = models.CharField(max_length=80, unique=True, db_index=True)
    slug = models.SlugField(max_length=100, unique=True)
    category = models.CharField(
        max_length=60,
        blank=True,
        help_text="Optional grouping such as 'Programming', 'Data', 'Soft Skills'.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "skills"
        ordering = ["name"]
        verbose_name = "Skill"
        verbose_name_plural = "Skills"

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return self.name

    def save(self, *args, **kwargs):
        """Derive the slug from the skill name."""
        if not self.slug:
            self.slug = slugify(self.name)[:100] or "skill"
        super().save(*args, **kwargs)


class StudentSkill(TimeStampedModel):
    """Junction model linking a student to a skill with a proficiency level."""

    student = models.ForeignKey(
        "accounts.StudentProfile", on_delete=models.CASCADE, related_name="skills"
    )
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="student_skills")
    proficiency_level = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Self-declared proficiency from 1 (beginner) to 5 (expert).",
    )
    is_certified = models.BooleanField(default=False)

    class Meta:
        db_table = "student_skills"
        ordering = ["-proficiency_level", "skill__name"]
        constraints = [
            models.UniqueConstraint(fields=["student", "skill"], name="uniq_student_skill"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.student.roll_number} - {self.skill.name}"


class JobDrive(TimeStampedModel):
    """A recruitment drive (job opening) published by a company."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        CLOSED = "closed", "Closed"
        CANCELLED = "cancelled", "Cancelled"

    class JobType(models.TextChoices):
        FULL_TIME = "full_time", "Full Time"
        INTERNSHIP = "internship", "Internship"

    class DriveMode(models.TextChoices):
        ON_CAMPUS = "on_campus", "On Campus"
        OFF_CAMPUS = "off_campus", "Off Campus"
        ONLINE = "online", "Online"

    title = models.CharField(max_length=180, db_index=True)
    company = models.ForeignKey(
        "companies.Company", on_delete=models.PROTECT, related_name="job_drives"
    )
    role_designation = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    job_type = models.CharField(
        max_length=20, choices=JobType.choices, default=JobType.FULL_TIME
    )
    drive_mode = models.CharField(
        max_length=20, choices=DriveMode.choices, default=DriveMode.ON_CAMPUS
    )
    package_min = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Lowest annual package offered, in INR.",
    )
    package_max = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        help_text="Highest annual package offered, in INR.",
    )
    min_cgpa = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Minimum CGPA required; NULL means no CGPA restriction.",
    )
    max_active_backlogs = models.PositiveIntegerField(
        null=True, blank=True, help_text="Maximum permitted active backlogs; NULL means unlimited."
    )
    allowed_departments = models.ManyToManyField(
        "students.Department",
        related_name="eligible_drives",
        blank=True,
        help_text="Empty means the drive is open to every department.",
    )
    min_graduation_year = models.PositiveIntegerField(null=True, blank=True)
    max_graduation_year = models.PositiveIntegerField(null=True, blank=True)
    application_deadline = models.DateTimeField(db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True
    )
    eligibility_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "accounts.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="job_drives_created",
    )
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "job_drives"
        ordering = ["-created_at"]
        verbose_name = "Job drive"
        verbose_name_plural = "Job drives"
        indexes = [
            models.Index(fields=["status", "application_deadline"], name="drive_status_deadline_idx"),
            models.Index(fields=["company", "status"], name="drive_company_status_idx"),
            models.Index(fields=["-created_at"], name="drive_created_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.title} @ {self.company.name}"

    # -- Derived state -----------------------------------------------------
    @property
    def is_open(self) -> bool:
        """True when the drive accepts new applications right now."""
        return (
            self.status == self.Status.PUBLISHED
            and self.application_deadline > timezone.now()
        )

    @property
    def is_deadline_passed(self) -> bool:
        """True when the application deadline has elapsed."""
        return self.application_deadline <= timezone.now()

    @property
    def days_to_deadline(self) -> int:
        """Whole days remaining before the deadline (may be negative)."""
        delta = self.application_deadline - timezone.now()
        return max(0, delta.days) if delta.total_seconds() > 0 else 0


class JobDriveSkill(TimeStampedModel):
    """Junction model linking a job drive to the skills it requires."""

    class Requirement(models.TextChoices):
        REQUIRED = "required", "Required"
        PREFERRED = "preferred", "Preferred"

    job_drive = models.ForeignKey(JobDrive, on_delete=models.CASCADE, related_name="required_skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="drive_skills")
    requirement_level = models.CharField(
        max_length=16, choices=Requirement.choices, default=Requirement.REQUIRED
    )
    min_proficiency = models.PositiveSmallIntegerField(
        default=1, validators=[MinValueValidator(1), MaxValueValidator(5)]
    )

    class Meta:
        db_table = "job_drive_skills"
        ordering = ["job_drive", "skill__name"]
        constraints = [
            models.UniqueConstraint(fields=["job_drive", "skill"], name="uniq_drive_skill"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.job_drive.title}: {self.skill.name} ({self.requirement_level})"
