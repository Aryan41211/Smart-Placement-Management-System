"""Reporting aggregations.

Every metric is computed with SQL aggregation (``Count``, ``Sum``, ``Avg``)
inside the database. The frontend never receives raw rows to aggregate.
"""

from __future__ import annotations

from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from accounts.models import StudentProfile, User
from applications.models import Application
from companies.models import Company
from interviews.models import Interview
from placements.models import JobDrive
from students.models import Department

#: Statuses that count as "in progress" for the student dashboard.
ACTIVE_STATUSES = [
    Application.Status.APPLIED,
    Application.Status.UNDER_REVIEW,
    Application.Status.SHORTLISTED,
    Application.Status.INTERVIEW,
]


def admin_dashboard() -> dict:
    """Return the placement-officer dashboard metrics."""
    total_students = StudentProfile.objects.count()
    total_companies = Company.objects.filter(is_active=True).count()
    active_drives = JobDrive.objects.filter(
        status=JobDrive.Status.PUBLISHED, application_deadline__gt=timezone.now()
    ).count()
    total_drives = JobDrive.objects.count()
    total_applications = Application.objects.count()
    placed_students = (
        Application.objects.filter(status=Application.Status.SELECTED)
        .values("student_id")
        .distinct()
        .count()
    )
    eligible_students = StudentProfile.objects.filter(
        graduation_year__gte=timezone.now().year
    ).count()

    placement_rate = 0.0
    if total_students:
        placement_rate = round(placed_students * 100.0 / total_students, 2)

    package_avg = (
        Application.objects.filter(status=Application.Status.SELECTED)
        .exclude(offer_package=None)
        .aggregate(avg=Avg("offer_package"))
        .get("avg")
    )

    interviews = Interview.objects.filter(status=Interview.Status.SCHEDULED).count()

    return {
        "total_students": total_students,
        "eligible_students": eligible_students,
        "total_companies": total_companies,
        "total_drives": total_drives,
        "active_drives": active_drives,
        "total_applications": total_applications,
        "placed_students": placed_students,
        "unplaced_students": max(total_students - placed_students, 0),
        "placement_rate": placement_rate,
        "average_package": float(package_avg) if package_avg is not None else None,
        "scheduled_interviews": interviews,
        "generated_at": timezone.now().isoformat(),
    }


def student_dashboard(student: StudentProfile) -> dict:
    """Return the dashboard metrics for a single student."""
    from placements.services import evaluate_eligibility

    applications = Application.objects.filter(student=student)
    total_applications = applications.count()
    in_progress = applications.filter(status__in=ACTIVE_STATUSES).count()
    shortlisted = applications.filter(status=Application.Status.SHORTLISTED).count()
    interviews = applications.filter(status=Application.Status.INTERVIEW).count()
    selected = applications.filter(status=Application.Status.SELECTED).count()
    rejected = applications.filter(
        status__in=[Application.Status.REJECTED, Application.Status.NOT_SELECTED]
    ).count()
    withdrawn = applications.filter(status=Application.Status.WITHDRAWN).count()

    published_drives = list(
        JobDrive.objects.filter(
            status=JobDrive.Status.PUBLISHED, application_deadline__gt=timezone.now()
        ).prefetch_related("allowed_departments", "required_skills__skill")
    )
    applied_drive_ids = set(applications.values_list("job_drive_id", flat=True))
    eligible_count = 0
    eligible_ids: list[int] = []
    for drive in published_drives:
        if drive.pk in applied_drive_ids:
            continue
        if evaluate_eligibility(student, drive).eligible:
            eligible_count += 1
            eligible_ids.append(drive.pk)

    scheduled_interviews = Interview.objects.filter(
        application__student=student, scheduled_at__gte=timezone.now()
    ).count()

    return {
        "eligible_drives": eligible_count,
        "eligible_drive_ids": eligible_ids,
        "total_drives_open": len(published_drives),
        "total_applications": total_applications,
        "applications_in_progress": in_progress,
        "shortlisted": shortlisted,
        "interviews": interviews,
        "scheduled_interviews": scheduled_interviews,
        "selected": selected,
        "rejected": rejected,
        "withdrawn": withdrawn,
        "is_placed": selected > 0,
        "generated_at": timezone.now().isoformat(),
    }


def recruiter_dashboard(user: User) -> dict:
    """Return the dashboard metrics for a recruiter."""
    profile = getattr(user, "recruiter_profile", None)
    company_id = getattr(profile, "company_id", None)

    drives = JobDrive.objects.filter(company_id=company_id) if company_id else JobDrive.objects.none()
    applications = (
        Application.objects.filter(job_drive__company_id=company_id)
        if company_id
        else Application.objects.none()
    )

    return {
        "company_id": company_id,
        "company_name": profile.company.name if profile and profile.company else None,
        "total_drives": drives.count(),
        "active_drives": drives.filter(
            status=JobDrive.Status.PUBLISHED, application_deadline__gt=timezone.now()
        ).count(),
        "draft_drives": drives.filter(status=JobDrive.Status.DRAFT).count(),
        "total_applicants": applications.count(),
        "shortlisted": applications.filter(status=Application.Status.SHORTLISTED).count(),
        "in_interview": applications.filter(status=Application.Status.INTERVIEW).count(),
        "selected": applications.filter(status=Application.Status.SELECTED).count(),
        "rejected": applications.filter(
            status__in=[Application.Status.REJECTED, Application.Status.NOT_SELECTED]
        ).count(),
        "interviews_scheduled": Interview.objects.filter(
            round__job_drive__company_id=company_id, status=Interview.Status.SCHEDULED
        ).count(),
        "generated_at": timezone.now().isoformat(),
    }


def department_placement_stats() -> list[dict]:
    """Return department-wise placement statistics."""
    rows = (
        Department.objects.annotate(
            student_count=Count("students", distinct=True),
            applicant_count=Count(
                "students__applications", filter=Q(students__applications__isnull=False), distinct=True
            ),
            placed_count=Count(
                "students",
                filter=Q(students__applications__status=Application.Status.SELECTED),
                distinct=True,
            ),
        )
        .order_by("name")
    )

    results = []
    for row in rows:
        rate = 0.0
        if row.student_count:
            rate = round(row.placed_count * 100.0 / row.student_count, 2)
        results.append(
            {
                "department_id": row.id,
                "department_code": row.code,
                "department_name": row.name,
                "student_count": row.student_count,
                "applicant_count": row.applicant_count,
                "placed_count": row.placed_count,
                "placement_rate": rate,
            }
        )
    return results


def company_recruitment_stats() -> list[dict]:
    """Return company-wise recruitment statistics."""
    rows = (
        Company.objects.annotate(
            drive_count=Count("job_drives", distinct=True),
            applicant_count=Count(
                "job_drives__applications", filter=Q(job_drives__applications__isnull=False), distinct=True
            ),
            selected_count=Count(
                "job_drives__applications",
                filter=Q(job_drives__applications__status=Application.Status.SELECTED),
                distinct=True,
            ),
        )
        .order_by("-selected_count", "name")
    )
    results = []
    for row in rows:
        rate = 0.0
        if row.applicant_count:
            rate = round(row.selected_count * 100.0 / row.applicant_count, 2)
        results.append(
            {
                "company_id": row.id,
                "company_name": row.name,
                "industry": row.industry,
                "drive_count": row.drive_count,
                "applicant_count": row.applicant_count,
                "selected_count": row.selected_count,
                "selection_rate": rate,
            }
        )
    return results


def application_funnel() -> list[dict]:
    """Return the application funnel counts for every known status."""
    counts = {
        row["status"]: row["count"]
        for row in Application.objects.values("status").annotate(count=Count("id"))
    }
    order = [
        Application.Status.APPLIED,
        Application.Status.UNDER_REVIEW,
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEW,
        Application.Status.SELECTED,
        Application.Status.REJECTED,
        Application.Status.NOT_SELECTED,
        Application.Status.WITHDRAWN,
    ]
    return [{"status": status, "count": counts.get(status, 0)} for status in order]


def top_recruiters(limit: int = 5) -> list[dict]:
    """Return the companies that selected the most students."""
    rows = (
        Application.objects.filter(status=Application.Status.SELECTED)
        .values("job_drive__company_id", "job_drive__company__name")
        .annotate(selected_count=Count("id"))
        .order_by("-selected_count")[:limit]
    )
    return [
        {
            "company_id": row["job_drive__company_id"],
            "company_name": row["job_drive__company__name"],
            "selected_count": row["selected_count"],
        }
        for row in rows
    ]


def recent_activity(limit: int = 10) -> list[dict]:
    """Return the most recent application status changes."""
    from applications.models import ApplicationStatusHistory

    rows = (
        ApplicationStatusHistory.objects.select_related(
            "changed_by", "application__student__user", "application__job_drive"
        )
        .order_by("-changed_at")[:limit]
    )
    return [
        {
            "application_id": row.application_id,
            "student_name": row.application.student.user.full_name,
            "roll_number": row.application.student.roll_number,
            "job_drive": row.application.job_drive.title,
            "company": row.application.job_drive.company.name,
            "from_status": row.from_status,
            "to_status": row.to_status,
            "changed_by": row.changed_by.full_name if row.changed_by else "System",
            "changed_at": row.changed_at.isoformat(),
        }
        for row in rows
    ]


def package_statistics() -> dict:
    """Return aggregate package statistics for selected offers."""
    aggregate = Application.objects.filter(status=Application.Status.SELECTED).exclude(
        offer_package=None
    ).aggregate(
        average=Avg("offer_package"),
        highest=Sum("offer_package"),
        lowest=Sum("offer_package"),
    )
    values = Application.objects.filter(
        status=Application.Status.SELECTED
    ).exclude(offer_package=None).values_list("offer_package", flat=True)
    values = [Decimal(v) for v in values]
    return {
        "count": len(values),
        "average": float(aggregate["average"]) if aggregate["average"] is not None else None,
        "highest": float(max(values)) if values else None,
        "lowest": float(min(values)) if values else None,
    }


def drive_summary(company_id: int | None = None) -> list[dict]:
    """Return drive-wise recruitment summary rows.

    When ``company_id`` is supplied only that company's drives are returned.
    """
    rows = (
        JobDrive.objects.select_related("company")
        .annotate(
            application_count=Count("applications", distinct=True),
            shortlisted_count=Count(
                "applications",
                filter=Q(applications__status=Application.Status.SHORTLISTED),
                distinct=True,
            ),
            selected_count=Count(
                "applications",
                filter=Q(applications__status=Application.Status.SELECTED),
                distinct=True,
            ),
        )
        .order_by("-created_at")
    )
    if company_id is not None:
        rows = rows.filter(company_id=company_id)
    return [
        {
            "drive_id": row.id,
            "title": row.title,
            "company_id": row.company_id,
            "company": row.company.name,
            "status": row.status,
            "deadline": row.application_deadline.isoformat(),
            "application_count": row.application_count,
            "shortlisted_count": row.shortlisted_count,
            "selected_count": row.selected_count,
        }
        for row in rows
    ]


def recruiter_analytics(user: User) -> dict:
    """Return analytics restricted to the recruiter's own company."""
    profile = getattr(user, "recruiter_profile", None)
    company_id = getattr(profile, "company_id", None)
    if company_id is None:
        return {"drives": [], "funnel": [], "packages": {"count": 0}}

    counts = {
        row["status"]: row["count"]
        for row in Application.objects.filter(job_drive__company_id=company_id)
        .values("status")
        .annotate(count=Count("id"))
    }
    order = [
        Application.Status.APPLIED,
        Application.Status.UNDER_REVIEW,
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEW,
        Application.Status.SELECTED,
        Application.Status.REJECTED,
        Application.Status.NOT_SELECTED,
        Application.Status.WITHDRAWN,
    ]
    packages = list(
        Application.objects.filter(
            job_drive__company_id=company_id, status=Application.Status.SELECTED
        )
        .exclude(offer_package=None)
        .values_list("offer_package", flat=True)
    )
    return {
        "drives": drive_summary(company_id=company_id),
        "funnel": [{"status": status, "count": counts.get(status, 0)} for status in order],
        "packages": {
            "count": len(packages),
            "average": float(sum(packages) / len(packages)) if packages else None,
            "highest": float(max(packages)) if packages else None,
            "lowest": float(min(packages)) if packages else None,
        },
    }
