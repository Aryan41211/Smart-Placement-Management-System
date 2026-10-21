"""Application submission, tracking and recruitment pipeline endpoints."""

from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import StudentProfile
from applications.models import Application, ApplicationStatusHistory
from applications.serializers import (
    ApplicationCreateSerializer,
    ApplicationNoteSerializer,
    ApplicationSerializer,
    ApplicationStatusChangeSerializer,
    ApplicationStatusHistorySerializer,
)
from applications.services import submit_application, transition_application


class ApplicationViewSet(viewsets.ModelViewSet):
    """List, submit and progress applications."""

    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]
    filterset_fields = ["status", "job_drive", "job_drive__company"]
    ordering_fields = ["applied_at", "status_changed_at", "student__cgpa"]
    ordering = ["-applied_at"]
    search_fields = [
        "student__roll_number",
        "student__user__full_name",
        "job_drive__title",
        "job_drive__company__name",
    ]

    def get_queryset(self):
        """Scope applications by the caller's role and apply list filters."""
        queryset = (
            Application.objects.select_related(
                "student__user",
                "student__department",
                "job_drive__company",
            )
            .annotate(interview_count=Count("interviews", distinct=True))
        )
        user = self.request.user
        if user.is_admin:
            pass
        elif user.is_recruiter:
            profile = getattr(user, "recruiter_profile", None)
            if profile is None or profile.company_id is None:
                return queryset.none()
            queryset = queryset.filter(job_drive__company_id=profile.company_id)
        else:
            queryset = queryset.filter(student__user=user)

        params = self.request.query_params
        department = params.get("department")
        if department:
            queryset = queryset.filter(student__department_id=department)
        min_cgpa = params.get("min_cgpa")
        if min_cgpa:
            queryset = queryset.filter(student__cgpa__gte=min_cgpa)
        max_cgpa = params.get("max_cgpa")
        if max_cgpa:
            queryset = queryset.filter(student__cgpa__lte=max_cgpa)
        skill = params.get("skill")
        if skill:
            queryset = queryset.filter(student__skills__skill__name__iexact=skill)
        applied_after = params.get("applied_after")
        if applied_after:
            queryset = queryset.filter(applied_at__date__gte=applied_after)
        return queryset.distinct()

    def get_serializer_class(self):
        """Use the create serializer for the collection POST."""
        if self.action == "create":
            return ApplicationCreateSerializer
        return ApplicationSerializer

    def has_object_permission(self, request, view, obj):
        """Students see their own applications, recruiters their company's."""
        user = request.user
        if user.is_admin:
            return True
        if user.is_student:
            return obj.student.user_id == user.pk
        if user.is_recruiter:
            profile = getattr(user, "recruiter_profile", None)
            return (
                profile is not None
                and profile.company_id is not None
                and obj.job_drive.company_id == profile.company_id
            )
        return False

    def create(self, request, *args, **kwargs):
        """Submit an application for the authenticated student."""
        student = StudentProfile.objects.filter(user=request.user).first()
        if student is None:
            raise PermissionDenied("Only students can submit applications.")
        serializer = ApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = submit_application(
            student,
            serializer.validated_data["job_drive"],
            actor=request.user,
            resume_url=serializer.validated_data.get("resume_url", ""),
        )
        return Response(
            ApplicationSerializer(application, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_update(self, serializer):
        """Block direct status writes; the workflow service must be used."""
        raise ValidationError(
            {"detail": "Use the status endpoint to move an application through the pipeline."}
        )

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """``GET /api/v1/applications/:id/history/`` - the status trail."""
        application = self.get_object()
        history = ApplicationStatusHistory.objects.filter(application=application).select_related(
            "changed_by"
        )
        return Response(
            ApplicationStatusHistorySerializer(history, many=True).data, status=status.HTTP_200_OK
        )

    @action(detail=True, methods=["post"], url_path="status")
    def change_status(self, request, pk=None):
        """``POST /api/v1/applications/:id/status/`` - move the pipeline."""
        application = self.get_object()
        serializer = ApplicationStatusChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = transition_application(
            application,
            serializer.validated_data["new_status"],
            actor=request.user,
            reason=serializer.validated_data.get("reason", ""),
            offer_package=serializer.validated_data.get("offer_package"),
            request=request,
        )
        return Response(
            ApplicationSerializer(updated, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["patch"], url_path="notes")
    def update_notes(self, request, pk=None):
        """``PATCH /api/v1/applications/:id/notes/`` - recruiter-only notes."""
        application = self.get_object()
        if request.user.is_student:
            raise PermissionDenied("Only recruiters and placement officers can add notes.")
        serializer = ApplicationNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application.internal_notes = serializer.validated_data.get("internal_notes", "")
        application.save(update_fields=["internal_notes", "updated_at"])
        return Response(
            ApplicationSerializer(application, context=self.get_serializer_context()).data,
            status=status.HTTP_200_OK,
        )


class MyApplicationListView(viewsets.ViewSet):
    """Convenience endpoint returning the authenticated student's applications."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return every application belonging to the authenticated student."""
        queryset = (
            Application.objects.filter(student__user=request.user)
            .select_related("job_drive__company", "student")
            .annotate(interview_count=Count("interviews", distinct=True))
            .order_by("-applied_at")
        )
        return Response(ApplicationSerializer(queryset, many=True).data, status=status.HTTP_200_OK)


class ApplicationSummaryView(viewsets.ViewSet):
    """Aggregate counts describing the caller's application pipeline."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return the number of applications per status."""
        queryset = Application.objects.all()
        if request.user.is_student:
            queryset = queryset.filter(student__user=request.user)
        elif request.user.is_recruiter:
            profile = getattr(request.user, "recruiter_profile", None)
            queryset = queryset.filter(job_drive__company_id=getattr(profile, "company_id", None))
        rows = (
            queryset.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        return Response(
            {"counts": [{"status": row["status"], "count": row["count"]} for row in rows]},
            status=status.HTTP_200_OK,
        )
