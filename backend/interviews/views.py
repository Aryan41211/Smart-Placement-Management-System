"""Interview round management and interview scheduling endpoints."""

from __future__ import annotations

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from applications.models import Application
from core.audit import record_audit
from interviews.models import Interview, InterviewRound
from interviews.serializers import (
    InterviewCreateSerializer,
    InterviewOutcomeSerializer,
    InterviewRoundSerializer,
    InterviewSerializer,
)
from notifications.models import Notification
from notifications.services import notify


def _may_manage(user, company_id) -> bool:
    """True when the user may manage interviews for the given company."""
    if user.is_admin:
        return True
    profile = getattr(user, "recruiter_profile", None)
    return (
        profile is not None
        and profile.is_authorized
        and profile.company_id is not None
        and profile.company_id == company_id
    )


class InterviewRoundViewSet(viewsets.ModelViewSet):
    """Manage the ordered interview rounds of a placement drive."""

    permission_classes = [IsAuthenticated]
    filterset_fields = ["job_drive", "is_active"]
    ordering_fields = ["sequence", "created_at"]
    ordering = ["job_drive", "sequence"]
    search_fields = ["name", "job_drive__title"]

    def get_queryset(self):
        """Scope rounds by role and annotate the interview count."""
        queryset = (
            InterviewRound.objects.select_related("job_drive__company")
            .annotate(interview_count=Count("interviews", distinct=True))
        )
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_recruiter:
            profile = getattr(user, "recruiter_profile", None)
            return queryset.filter(job_drive__company_id=getattr(profile, "company_id", None))
        # Students only see rounds of drives they have applied to.
        return queryset.filter(job_drive__applications__student__user=user).distinct()

    def perform_create(self, serializer):
        """Create the round, enforcing company ownership for recruiters."""
        user = self.request.user
        drive = serializer.validated_data["job_drive"]
        if not _may_manage(user, drive.company_id):
            raise PermissionDenied("You cannot manage rounds for this drive.")
        serializer.save(created_by=user)

    def has_object_permission(self, request, view, obj):
        """Object level authorisation for interview rounds."""
        user = request.user
        if user.is_admin:
            return True
        if user.is_recruiter:
            return _may_manage(user, obj.job_drive.company_id)
        return obj.job_drive.applications.filter(student__user=user).exists()


class InterviewViewSet(viewsets.ModelViewSet):
    """Schedule interviews and record their outcomes."""

    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "outcome", "round", "mode", "application"]
    ordering_fields = ["scheduled_at", "created_at"]
    ordering = ["scheduled_at"]
    search_fields = [
        "application__student__roll_number",
        "application__student__user__full_name",
        "round__name",
    ]

    def get_queryset(self):
        """Scope interviews by role."""
        queryset = Interview.objects.select_related(
            "application__student__user",
            "application__student__department",
            "round__job_drive__company",
        )
        user = self.request.user
        if user.is_admin:
            return queryset
        if user.is_recruiter:
            profile = getattr(user, "recruiter_profile", None)
            return queryset.filter(round__job_drive__company_id=getattr(profile, "company_id", None))
        return queryset.filter(application__student__user=user)

    def get_serializer_class(self):
        """Use the dedicated create serializer for scheduling."""
        if self.action == "create":
            return InterviewCreateSerializer
        if self.action == "record_outcome":
            return InterviewOutcomeSerializer
        return InterviewSerializer

    def has_object_permission(self, request, view, obj):
        """Object level authorisation for interviews."""
        user = request.user
        if user.is_admin:
            return True
        if user.is_recruiter:
            return _may_manage(user, obj.round.job_drive.company_id)
        return obj.application.student.user_id == user.pk

    def create(self, request, *args, **kwargs):
        """Schedule an interview and notify the student."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = serializer.validated_data["application"]
        drive_company_id = application.job_drive.company_id
        if not _may_manage(request.user, drive_company_id):
            raise PermissionDenied("You cannot schedule interviews for this drive.")

        interview = serializer.save(scheduled_by=request.user)
        notify(
            recipient=application.student.user,
            kind=Notification.Kind.INTERVIEW,
            title=f"Interview scheduled for {interview.round.job_drive.title}",
            message=(
                f"Your {interview.round.name} for {interview.round.job_drive.role_designation} "
                f"is scheduled for {interview.scheduled_at:%d %b %Y, %I:%M %p}."
            ),
            link=f"/student/interviews",
        )
        record_audit(
            actor=request.user,
            action="create",
            entity_type="Interview",
            entity_id=interview.pk,
            description=f"Interview scheduled for application {application.pk}",
            request=request,
        )
        payload = InterviewSerializer(interview, context=self.get_serializer_context()).data
        return Response(payload, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="outcome")
    def record_outcome(self, request, pk=None):
        """``POST /api/v1/interviews/:id/outcome/`` - record the result."""
        interview = self.get_object()
        if not _may_manage(request.user, interview.round.job_drive.company_id):
            raise PermissionDenied("You cannot record outcomes for this drive.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        interview.status = serializer.validated_data.get("status", Interview.Status.COMPLETED)
        interview.outcome = serializer.validated_data["outcome"]
        interview.feedback = serializer.validated_data.get("feedback", "")
        if interview.status == Interview.Status.COMPLETED:
            interview.completed_at = timezone.now()
        interview.save(
            update_fields=["status", "outcome", "feedback", "completed_at", "updated_at"]
        )

        notify(
            recipient=interview.application.student.user,
            kind=Notification.Kind.RESULT,
            title=f"Interview result for {interview.round.job_drive.title}",
            message=(
                f"Your {interview.round.name} outcome is recorded as "
                f"{interview.get_outcome_display().lower()}."
            ),
            link="/student/interviews",
        )
        payload = InterviewSerializer(interview, context=self.get_serializer_context()).data
        return Response(payload, status=status.HTTP_200_OK)


class MyInterviewListView(viewsets.ViewSet):
    """Interviews scheduled for the authenticated student."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return the student's upcoming and past interviews."""
        queryset = (
            Interview.objects.filter(application__student__user=request.user)
            .select_related("round__job_drive__company", "application__student")
            .order_by("scheduled_at")
        )
        upcoming = request.query_params.get("upcoming")
        if upcoming in {"true", "1"}:
            queryset = queryset.filter(scheduled_at__gte=timezone.now())
        return Response(InterviewSerializer(queryset, many=True).data, status=status.HTTP_200_OK)
