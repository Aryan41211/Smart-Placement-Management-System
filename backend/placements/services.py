"""Placement eligibility engine.

Eligibility is always computed on the server from stored data and the trusted
requirements recorded on the job drive. The frontend only renders the result.

Policy notes
------------
* A drive that is not ``PUBLISHED`` never accepts applications.
* A drive whose deadline has passed never accepts applications.
* ``min_cgpa = NULL`` means "no CGPA restriction".
* An empty ``allowed_departments`` set means "open to all departments".
* ``max_active_backlogs = NULL`` means "backlogs are not considered".
* Only skills marked ``REQUIRED`` on the drive must be present; ``PREFERRED``
  skills never block an application.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone


@dataclass
class EligibilityResult:
    """Outcome of an eligibility evaluation.

    ``reasons`` holds stable machine readable codes; ``messages`` holds the
    human readable explanation shown to the student.
    """

    eligible: bool
    reasons: list[str] = field(default_factory=list)
    messages: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)

    def as_dict(self) -> dict:
        """Serialise the result for the API."""
        return {
            "eligible": self.eligible,
            "reasons": list(self.reasons),
            "messages": list(self.messages),
            "details": dict(self.details),
        }


def evaluate_eligibility(student, job_drive) -> EligibilityResult:
    """Evaluate whether ``student`` may apply to ``job_drive``.

    Args:
        student: a :class:`~accounts.models.StudentProfile` instance.
        job_drive: a :class:`~placements.models.JobDrive` instance.

    Returns:
        An :class:`EligibilityResult` describing every failed criterion.
    """
    reasons: list[str] = []
    messages: list[str] = []
    details: dict = {}

    # 1. The drive must be published.
    if job_drive.status != job_drive.Status.PUBLISHED:
        reasons.append("drive_not_published")
        messages.append("Applications are not open for this placement drive yet.")
        details["drive_status"] = job_drive.status

    # 2. The deadline must not have elapsed.
    now = timezone.now()
    if job_drive.application_deadline <= now:
        reasons.append("deadline_passed")
        messages.append("The application deadline for this drive has passed.")
    details["deadline"] = job_drive.application_deadline.isoformat()

    # 3. Minimum CGPA.
    if job_drive.min_cgpa is not None and student.cgpa < job_drive.min_cgpa:
        reasons.append("cgpa_below_minimum")
        messages.append(
            f"Your CGPA ({student.cgpa:.2f}) is below the minimum required "
            f"({job_drive.min_cgpa:.2f}) for this drive."
        )
    details["student_cgpa"] = float(student.cgpa)
    details["minimum_cgpa"] = (
        float(job_drive.min_cgpa) if job_drive.min_cgpa is not None else None
    )

    # 4. Department restriction.
    allowed_ids = set(job_drive.allowed_departments.values_list("id", flat=True))
    if allowed_ids and student.department_id not in allowed_ids:
        reasons.append("department_not_permitted")
        messages.append(
            f"This drive is open only to students of "
            f"{', '.join(job_drive.allowed_departments.values_list('name', flat=True))}."
        )
    details["department_id"] = student.department_id
    details["allowed_department_ids"] = sorted(allowed_ids)

    # 5. Active backlog limit.
    if (
        job_drive.max_active_backlogs is not None
        and student.active_backlogs > job_drive.max_active_backlogs
    ):
        reasons.append("backlogs_exceed_limit")
        messages.append(
            f"You have {student.active_backlogs} active backlog(s) but this drive "
            f"allows at most {job_drive.max_active_backlogs}."
        )
    details["active_backlogs"] = student.active_backlogs
    details["max_active_backlogs"] = job_drive.max_active_backlogs

    # 6. Required skills.
    required_skill_ids = set(
        job_drive.required_skills.filter(
            requirement_level="required"
        ).values_list("skill_id", flat=True)
    )
    if required_skill_ids:
        held_skill_ids = set(student.skills.values_list("skill_id", flat=True))
        missing_ids = required_skill_ids - held_skill_ids
        if missing_ids:
            missing_names = list(
                job_drive.required_skills.filter(skill_id__in=missing_ids)
                .values_list("skill__name", flat=True)
                .distinct()
            )
            reasons.append("missing_required_skills")
            messages.append(f"Missing required skill(s): {', '.join(sorted(missing_names))}.")
        details["required_skill_ids"] = sorted(required_skill_ids)
        details["missing_skill_ids"] = sorted(missing_ids)

    # 7. Graduation year window.
    if (
        job_drive.min_graduation_year is not None
        and student.graduation_year < job_drive.min_graduation_year
    ):
        reasons.append("graduation_year_not_eligible")
        messages.append(
            f"This drive is open to students graduating in "
            f"{job_drive.min_graduation_year} or later."
        )
    if (
        job_drive.max_graduation_year is not None
        and student.graduation_year > job_drive.max_graduation_year
    ):
        reasons.append("graduation_year_not_eligible")
        messages.append(
            f"This drive is open to students graduating in "
            f"{job_drive.max_graduation_year} or earlier."
        )
    details["graduation_year"] = student.graduation_year

    return EligibilityResult(
        eligible=not reasons,
        reasons=reasons,
        messages=messages,
        details=details,
    )


def student_visible_drive_qs(student):
    """Return the drives a student is allowed to see in the drive catalogue.

    Students see published drives plus their own drafts (recruiters and
    administrators use the dedicated management endpoints instead).
    """
    from placements.models import JobDrive

    now = timezone.now()
    return (
        JobDrive.objects.filter(
            Q(status=JobDrive.Status.PUBLISHED) | Q(created_by=getattr(student, "user", None)),
            application_deadline__gte=now - timedelta(days=365),
        )
        .distinct()
    )


def eligible_drive_ids(student) -> set[int]:
    """Return the ids of published drives the student currently satisfies."""
    from placements.models import JobDrive

    eligible: set[int] = set()
    queryset = (
        JobDrive.objects.filter(status=JobDrive.Status.PUBLISHED)
        .filter(application_deadline__gt=timezone.now())
        .prefetch_related("allowed_departments", "required_skills__skill")
    )
    for drive in queryset:
        if evaluate_eligibility(student, drive).eligible:
            eligible.add(drive.pk)
    return eligible
