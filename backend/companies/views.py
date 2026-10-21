"""Company directory and recruiter administration endpoints."""

from __future__ import annotations

from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from companies.models import Company
from companies.serializers import (
    CompanySerializer,
    CompanyWriteSerializer,
    RecruiterProvisionSerializer,
    RecruiterSerializer,
)
from core.audit import record_audit
from core.permissions import IsAdmin


class CompanyViewSet(viewsets.ModelViewSet):
    """Browse and manage the participating companies."""

    permission_classes = [IsAuthenticated]
    filterset_fields = ["industry", "is_active"]
    ordering_fields = ["name", "created_at", "location"]
    ordering = ["name"]
    search_fields = ["name", "industry", "location", "description"]

    def get_queryset(self):
        """Return the company list with recruiter and drive counters."""
        queryset = Company.objects.annotate(
            recruiter_count=Count("recruiters", distinct=True),
            drive_count=Count("job_drives", distinct=True),
        )
        if self.request.user.is_student:
            queryset = queryset.filter(is_active=True)
        return queryset

    def get_serializer_class(self):
        """Use the write serializer for mutations."""
        if self.action in {"create", "update", "partial_update"}:
            return CompanyWriteSerializer
        return CompanySerializer

    def perform_create(self, serializer):
        """Create the company and record an audit entry."""
        company = serializer.save(created_by=self.request.user)
        record_audit(
            actor=self.request.user,
            action="create",
            entity_type="Company",
            entity_id=company.pk,
            description=f"Company '{company.name}' created",
            request=self.request,
        )

    def perform_update(self, serializer):
        """Update the company and record an audit entry."""
        company = serializer.save()
        record_audit(
            actor=self.request.user,
            action="update",
            entity_type="Company",
            entity_id=company.pk,
            description=f"Company '{company.name}' updated",
            request=self.request,
        )

    def perform_destroy(self, instance):
        """Deactivate instead of deleting a company that has drives."""
        if instance.job_drives.exists():
            instance.is_active = False
            instance.save(update_fields=["is_active", "updated_at"])
            record_audit(
                actor=self.request.user,
                action="update",
                entity_type="Company",
                entity_id=instance.pk,
                description=f"Company '{instance.name}' deactivated (it has placement drives)",
                request=self.request,
            )
            return
        instance.delete()

    @action(detail=True, methods=["get"])
    def drives(self, request, pk=None):
        """``GET /api/v1/companies/:id/drives/`` - drives published by a company."""
        from placements.models import JobDrive
        from placements.serializers import JobDriveSerializer

        company = self.get_object()
        queryset = (
            JobDrive.objects.filter(company=company)
            .select_related("company")
            .prefetch_related("allowed_departments", "required_skills__skill")
            .annotate(application_count=Count("applications", distinct=True))
        )
        if not request.user.is_admin:
            queryset = queryset.filter(status=JobDrive.Status.PUBLISHED)
        return Response(JobDriveSerializer(queryset, many=True).data, status=status.HTTP_200_OK)


class RecruiterViewSet(viewsets.ModelViewSet):
    """Placement-cell administration of recruiter accounts."""

    serializer_class = RecruiterSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ["company", "is_authorized", "can_post_jobs"]
    search_fields = ["user__full_name", "user__email", "company__name"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):
        """Return the recruiter list."""
        return (
            RecruiterProfile.objects.select_related("user", "company")
            .all()
        )

    @action(detail=False, methods=["post"], url_path="provision")
    def provision(self, request, *args, **kwargs):
        """``POST /api/v1/recruiters/provision/`` - create a recruiter account."""
        serializer = RecruiterProvisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        record_audit(
            actor=request.user,
            action="create",
            entity_type="RecruiterProfile",
            entity_id=profile.pk,
            description=f"Recruiter account {profile.user.email} provisioned",
            request=request,
        )
        return Response(RecruiterSerializer(profile).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="authorize")
    def authorize(self, request, pk=None):
        """``POST /api/v1/recruiters/:id/authorize/`` - grant drive management rights."""
        profile = self.get_object()
        profile.is_authorized = True
        profile.save(update_fields=["is_authorized", "updated_at"])
        record_audit(
            actor=request.user,
            action="approve",
            entity_type="RecruiterProfile",
            entity_id=profile.pk,
            description=f"Recruiter {profile.user.email} authorised",
            request=request,
        )
        return Response(RecruiterSerializer(profile).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, pk=None):
        """``POST /api/v1/recruiters/:id/revoke/`` - withdraw drive management rights."""
        profile = self.get_object()
        profile.is_authorized = False
        profile.save(update_fields=["is_authorized", "updated_at"])
        record_audit(
            actor=request.user,
            action="update",
            entity_type="RecruiterProfile",
            entity_id=profile.pk,
            description=f"Recruiter {profile.user.email} authorisation revoked",
            request=request,
        )
        return Response(RecruiterSerializer(profile).data, status=status.HTTP_200_OK)
