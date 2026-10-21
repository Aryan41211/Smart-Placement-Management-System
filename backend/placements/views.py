"""Job drive catalogue, administration and eligibility endpoints."""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import StudentProfile
from core.audit import record_audit
from core.permissions import IsAdmin
from placements.models import JobDrive
from placements.serializers import JobDriveSerializer, JobDriveWriteSerializer
from placements.services import evaluate_eligibility


def recruiter_company(user):
    """Return the company a recruiter is authorised to manage (``None`` if not)."""
    profile = getattr(user, "recruiter_profile", None)
    if profile is None or not profile.is_authorized or profile.company_id is None:
        return None
    return profile.company_id


class JobDriveViewSet(viewsets.ModelViewSet):
    """CRUD, publication workflow and eligibility for placement drives."""

    permission_classes = [IsAuthenticated]
    filterset_fields = ["company", "status", "job_type", "drive_mode"]
    ordering_fields = ["application_deadline", "created_at", "package_max", "title"]
    ordering = ["-created_at"]
    search_fields = ["title", "role_designation", "company__name", "description"]

    def get_queryset(self):
        """Scope the queryset by the caller's role."""
        queryset = (
            JobDrive.objects.select_related("company", "created_by")
            .prefetch_related("allowed_departments", "required_skills__skill")
            .annotate(application_count=Count("applications", distinct=True))
        )
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_recruiter:
            company_id = recruiter_company(user)
            if company_id is None:
                return queryset.none()
            return queryset.filter(Q(company_id=company_id) | Q(created_by=user))
        return queryset.filter(status=JobDrive.Status.PUBLISHED)

    def get_serializer_class(self):
        """Use the write serializer for mutations."""
        if self.action in {"create", "update", "partial_update"}:
            return JobDriveWriteSerializer
        return JobDriveSerializer

    # -- permissions --------------------------------------------------------
    def _is_owning_recruiter(self, obj) -> bool:
        """True when the caller is an authorised recruiter of the drive's company."""
        company_id = recruiter_company(self.request.user)
        return company_id is not None and obj.company_id == company_id

    def has_object_permission(self, request, view, obj):
        """Object level authorisation for drives."""
        if request.user.is_admin:
            return True
        if request.user.is_recruiter and request.method in {"GET", "HEAD", "OPTIONS"}:
            return self._is_owning_recruiter(obj) or obj.created_by_id == request.user.pk
        if request.user.is_recruiter and request.method in {"PUT", "PATCH"}:
            return self._is_owning_recruiter(obj) and obj.status == JobDrive.Status.DRAFT
        return False

    def perform_create(self, serializer):
        """Create a drive, enforcing company ownership for recruiters."""
        user = self.request.user
        company = serializer.validated_data.get("company")
        if user.is_recruiter:
            company_id = recruiter_company(user)
            if company_id is None:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "Your recruiter account has not been authorised for a company yet."
                )
            if company_id != company.id:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You can only create drives for your own company.")
            serializer.save(created_by=user, status=JobDrive.Status.DRAFT)
        else:
            serializer.save(created_by=user)

    def perform_update(self, serializer):
        """Record an audit entry when a drive is edited."""
        instance = self.get_object()
        serializer.save()
        record_audit(
            actor=self.request.user,
            action="update",
            entity_type="JobDrive",
            entity_id=instance.pk,
            description=f"Placement drive '{instance.title}' updated",
            request=self.request,
        )

    def perform_destroy(self, instance):
        """Block deletion of drives that already received applications."""
        if instance.applications.exists():
            from rest_framework.exceptions import ValidationError

            raise ValidationError(
                {"detail": "A drive with applications cannot be deleted; close or cancel it instead."}
            )
        record_audit(
            actor=self.request.user,
            action="delete",
            entity_type="JobDrive",
            entity_id=instance.pk,
            description=f"Placement drive '{instance.title}' deleted",
            request=self.request,
        )
        instance.delete()

    # -- publication workflow ----------------------------------------------
    def _transition(self, request, new_status, action_name, description):
        """Apply a status transition with an audit entry."""
        drive = self.get_object()
        if drive.status == new_status:
            return Response(
                {"detail": f"The drive is already {drive.get_status_display().lower()}."},
                status=status.HTTP_409_CONFLICT,
            )
        drive.status = new_status
        if new_status == JobDrive.Status.PUBLISHED:
            drive.published_at = timezone.now()
        if new_status in {JobDrive.Status.CLOSED, JobDrive.Status.CANCELLED}:
            drive.closed_at = timezone.now()
        drive.save(update_fields=["status", "published_at", "closed_at", "updated_at"])
        record_audit(
            actor=request.user,
            action=action_name,
            entity_type="JobDrive",
            entity_id=drive.pk,
            description=description.format(drive=drive.title),
            request=request,
        )
        return Response(JobDriveSerializer(drive).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdmin])
    def publish(self, request, pk=None):
        """``POST /api/v1/drives/:id/publish/`` - open applications."""
        return self._transition(
            request,
            JobDrive.Status.PUBLISHED,
            "publish",
            "Placement drive '{drive}' published",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdmin])
    def close(self, request, pk=None):
        """``POST /api/v1/drives/:id/close/`` - stop accepting applications."""
        return self._transition(
            request,
            JobDrive.Status.CLOSED,
            "close",
            "Placement drive '{drive}' closed",
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated, IsAdmin])
    def cancel(self, request, pk=None):
        """``POST /api/v1/drives/:id/cancel/`` - cancel the drive."""
        return self._transition(
            request,
            JobDrive.Status.CANCELLED,
            "cancel",
            "Placement drive '{drive}' cancelled",
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """``POST /api/v1/drives/:id/submit/`` - request placement-cell approval."""
        drive = self.get_object()
        if drive.status != JobDrive.Status.DRAFT:
            return Response(
                {"detail": "Only draft drives can be submitted for approval."},
                status=status.HTTP_409_CONFLICT,
            )
        if not (request.user.is_admin or self._is_owning_recruiter(drive)):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("You cannot submit this drive.")
        drive.submitted_at = timezone.now()
        drive.save(update_fields=["submitted_at", "updated_at"])
        record_audit(
            actor=request.user,
            action="update",
            entity_type="JobDrive",
            entity_id=drive.pk,
            description=f"Placement drive '{drive.title}' submitted for approval",
            request=request,
        )
        return Response(JobDriveSerializer(drive).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def eligibility(self, request, pk=None):
        """``GET /api/v1/drives/:id/eligibility/`` - evaluate a student.

        Students may only evaluate their own eligibility. Placement officers
        may pass ``?student_id=`` to evaluate another student.
        """
        drive = self.get_object()
        student_id = request.query_params.get("student_id")
        if request.user.is_student:
            student = StudentProfile.objects.filter(user=request.user).first()
        elif request.user.is_admin and student_id:
            student = StudentProfile.objects.filter(pk=student_id).first()
        elif request.user.is_recruiter and student_id:
            student = StudentProfile.objects.filter(pk=student_id).first()
        else:
            student = None

        if student is None:
            return Response(
                {
                    "error": {
                        "code": "not_found",
                        "message": "No student profile found for the requested evaluation.",
                    }
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(evaluate_eligibility(student, drive).as_dict(), status=status.HTTP_200_OK)
