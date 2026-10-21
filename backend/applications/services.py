"""Application lifecycle: submission and recruitment status transitions.

The state machine is the single source of truth for what may happen to an
application::

    applied -> under_review -> shortlisted -> interview -> selected
        |            |              |             |
        +------------+--------------+-------------+--> rejected / not_selected
        +-----------------------------------------------------------> withdrawn

Rules enforced here
-------------------
* A student may only apply to a published, open drive they are eligible for.
* One application per ``(student, job_drive)`` pair - guaranteed by a unique
  database constraint and re-checked inside the transaction.
* Every transition is validated against :data:`ALLOWED_TRANSITIONS`.
* Every transition writes an :class:`~applications.models.ApplicationStatusHistory`
  row inside the same transaction as the state change.
"""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from applications.models import Application, ApplicationStatusHistory
from notifications.models import Notification
from notifications.services import notify
from placements.models import JobDrive

#: Allowed forward transitions of the recruitment pipeline.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    Application.Status.APPLIED: {
        Application.Status.UNDER_REVIEW,
        Application.Status.SHORTLISTED,
        Application.Status.REJECTED,
        Application.Status.WITHDRAWN,
    },
    Application.Status.UNDER_REVIEW: {
        Application.Status.SHORTLISTED,
        Application.Status.INTERVIEW,
        Application.Status.REJECTED,
        Application.Status.WITHDRAWN,
    },
    Application.Status.SHORTLISTED: {
        Application.Status.INTERVIEW,
        Application.Status.SELECTED,
        Application.Status.NOT_SELECTED,
        Application.Status.REJECTED,
        Application.Status.WITHDRAWN,
    },
    Application.Status.INTERVIEW: {
        Application.Status.SELECTED,
        Application.Status.NOT_SELECTED,
        Application.Status.REJECTED,
        Application.Status.WITHDRAWN,
    },
    Application.Status.SELECTED: set(),
    Application.Status.REJECTED: set(),
    Application.Status.WITHDRAWN: set(),
    Application.Status.NOT_SELECTED: set(),
}

#: Statuses only the student may set on their own application.
STUDENT_ONLY_TRANSITIONS = {Application.Status.WITHDRAWN}


def can_transition(current: str, new: str) -> bool:
    """Return True when ``current -> new`` is a legal transition."""
    return new in ALLOWED_TRANSITIONS.get(current, set())


def _notify_status_change(application, previous_status, new_status, actor) -> None:
    """Send a notification to the student about a status change."""
    student_user = application.student.user
    labels = dict(Application.Status.choices)
    if new_status == Application.Status.SHORTLISTED:
        kind = Notification.Kind.SHORTLIST
        title = f"Shortlisted for {application.job_drive.title}"
        message = (
            f"You have been shortlisted for {application.job_drive.role_designation} "
            f"at {application.job_drive.company.name}."
        )
    elif new_status == Application.Status.INTERVIEW:
        kind = Notification.Kind.INTERVIEW
        title = f"Interview stage for {application.job_drive.title}"
        message = f"Your application for {application.job_drive.title} has moved to the interview stage."
    elif new_status == Application.Status.SELECTED:
        kind = Notification.Kind.RESULT
        title = f"Selected for {application.job_drive.title}"
        message = f"Congratulations! You have been selected for {application.job_drive.title}."
    elif new_status == Application.Status.REJECTED:
        kind = Notification.Kind.RESULT
        title = f"Application update for {application.job_drive.title}"
        message = f"Your application for {application.job_drive.title} was not progressed."
    elif new_status == Application.Status.NOT_SELECTED:
        kind = Notification.Kind.RESULT
        title = f"Result for {application.job_drive.title}"
        message = f"You were not selected in the final round for {application.job_drive.title}."
    elif new_status == Application.Status.WITHDRAWN:
        kind = Notification.Kind.APPLICATION
        title = f"Application withdrawn for {application.job_drive.title}"
        message = f"Your application for {application.job_drive.title} was withdrawn."
    else:
        kind = Notification.Kind.APPLICATION
        title = f"Application update for {application.job_drive.title}"
        message = (
            f"Your application for {application.job_drive.title} moved from "
            f"{labels.get(previous_status, previous_status)} to "
            f"{labels.get(new_status, new_status)}."
        )

    notify(
        recipient=student_user,
        kind=kind,
        title=title,
        message=message,
        link=f"/student/applications/{application.pk}",
    )


@transaction.atomic
def submit_application(student, job_drive, *, actor=None, resume_url: str = "") -> Application:
    """Submit an application on behalf of ``student``.

    The eligibility rules are re-evaluated inside the transaction, so a drive
    that closed between the catalogue view and the click is rejected.

    Raises:
        ValidationError: if the drive is closed, the deadline has passed, the
            student is ineligible, or an application already exists.
    """
    from placements.services import evaluate_eligibility

    drive = JobDrive.objects.select_for_update().get(pk=job_drive.pk)
    actor = actor or student.user

    if drive.status != drive.Status.PUBLISHED:
        raise ValidationError(
            {"detail": "Applications are not open for this placement drive."}
        )
    if drive.application_deadline <= timezone.now():
        raise ValidationError({"detail": "The application deadline for this drive has passed."})

    existing = Application.objects.filter(student=student, job_drive=drive).first()
    if existing is not None:
        raise ValidationError(
            {"detail": "You have already applied to this placement drive."}
        )

    result = evaluate_eligibility(student, drive)
    if not result.eligible:
        raise ValidationError(
            {
                "detail": "You are not eligible for this placement drive.",
                "reasons": result.reasons,
                "messages": result.messages,
            }
        )

    application = Application.objects.create(
        student=student,
        job_drive=drive,
        status=Application.Status.APPLIED,
        status_changed_at=timezone.now(),
        resume_url=resume_url or student.resume_url or "",
        eligibility_snapshot={
            "min_cgpa": float(drive.min_cgpa) if drive.min_cgpa is not None else None,
            "student_cgpa": float(student.cgpa),
            "active_backlogs": student.active_backlogs,
            "max_active_backlogs": drive.max_active_backlogs,
            "department_id": student.department_id,
            "graduation_year": student.graduation_year,
            "evaluated_at": timezone.now().isoformat(),
        },
    )
    ApplicationStatusHistory.objects.create(
        application=application,
        from_status="",
        to_status=Application.Status.APPLIED,
        changed_by=actor,
        changed_by_role=getattr(actor, "role", ""),
        reason="Application submitted",
    )
    notify(
        recipient=student.user,
        kind=Notification.Kind.APPLICATION,
        title=f"Application submitted for {drive.title}",
        message=f"Your application for {drive.title} at {drive.company.name} has been recorded.",
        link=f"/student/applications/{application.pk}",
    )
    return application


@transaction.atomic
def transition_application(
    application: Application,
    new_status: str,
    *,
    actor,
    reason: str = "",
    offer_package=None,
    request=None,
) -> Application:
    """Move an application to ``new_status``.

    Args:
        application: the :class:`~applications.models.Application` to update.
        new_status: one of :class:`~applications.models.Application.Status`.
        actor: the user performing the transition.
        reason: optional short explanation stored in the history trail.
        offer_package: optional final package recorded when selecting.

    Raises:
        ValidationError: when the transition is not allowed.
        PermissionDenied: when the actor may not drive this application.
    """
    from applications.models import Application as App
    from core.audit import record_audit

    locked = App.objects.select_for_update().select_related(
        "student__user", "job_drive__company"
    ).get(pk=application.pk)

    previous = locked.status
    if previous == new_status:
        raise ValidationError(
            {"detail": f"The application is already in the '{App.Status(new_status).label}' state."}
        )
    if not can_transition(previous, new_status):
        raise ValidationError(
            {
                "detail": (
                    f"Cannot move an application from '{App.Status(previous).label}' to "
                    f"'{App.Status(new_status).label}'."
                )
            }
        )

    _assert_actor_allowed(locked, new_status, actor)

    locked.status = new_status
    locked.status_changed_at = timezone.now()
    fields = ["status", "status_changed_at", "updated_at"]
    if new_status == App.Status.SHORTLISTED:
        locked.shortlisted_at = timezone.now()
        fields.append("shortlisted_at")
    if new_status == App.Status.SELECTED:
        locked.selected_at = timezone.now()
        fields.append("selected_at")
        if offer_package is not None:
            locked.offer_package = offer_package
            fields.append("offer_package")
    if new_status == App.Status.WITHDRAWN:
        locked.withdrawn_at = timezone.now()
        fields.append("withdrawn_at")
    if new_status in {App.Status.REJECTED, App.Status.NOT_SELECTED} and reason:
        locked.rejection_reason = reason[:500]
        fields.append("rejection_reason")
    locked.save(update_fields=fields)

    ApplicationStatusHistory.objects.create(
        application=locked,
        from_status=previous,
        to_status=new_status,
        changed_by=actor,
        changed_by_role=getattr(actor, "role", ""),
        reason=reason[:500],
    )

    record_audit(
        actor=actor,
        action="status_change",
        entity_type="Application",
        entity_id=locked.pk,
        description=(
            f"Application {locked.pk} moved from {previous} to {new_status}"
            + (f" ({reason})" if reason else "")
        ),
        metadata={"from_status": previous, "to_status": new_status},
        request=request,
    )

    _notify_status_change(locked, previous, new_status, actor)
    return locked


def _assert_actor_allowed(application: Application, new_status: str, actor) -> None:
    """Verify that ``actor`` may perform the requested transition."""
    if getattr(actor, "is_admin", False):
        return

    if getattr(actor, "is_student", False):
        owns = application.student.user_id == actor.pk
        if not owns:
            raise PermissionDenied("You can only manage your own applications.")
        if new_status not in STUDENT_ONLY_TRANSITIONS:
            raise PermissionDenied("Students can only withdraw their own applications.")
        return

    if getattr(actor, "is_recruiter", False):
        profile = getattr(actor, "recruiter_profile", None)
        if profile is None or not profile.is_authorized:
            raise PermissionDenied("Your recruiter account is not authorised.")
        if profile.company_id != application.job_drive.company_id:
            raise PermissionDenied(
                "You may only manage applications for your own company's drives."
            )
        return

    raise PermissionDenied("You are not allowed to change this application.")


def withdraw_application(application: Application, *, actor, reason: str = "") -> Application:
    """Withdraw an application on behalf of the student."""
    return transition_application(
        application,
        Application.Status.WITHDRAWN,
        actor=actor,
        reason=reason or "Withdrawn by the student",
    )
