"""Serializers for applications, status history and status changes."""

from __future__ import annotations

from rest_framework import serializers

from applications.models import Application, ApplicationStatusHistory
from placements.models import JobDrive


class ApplicationStatusHistorySerializer(serializers.ModelSerializer):
    """Read representation of one status transition."""

    changed_by_name = serializers.CharField(source="changed_by.full_name", read_only=True)
    changed_by_role = serializers.CharField(read_only=True)

    class Meta:
        model = ApplicationStatusHistory
        fields = (
            "id",
            "from_status",
            "to_status",
            "changed_by",
            "changed_by_name",
            "changed_by_role",
            "reason",
            "changed_at",
        )
        read_only_fields = fields


class ApplicationSerializer(serializers.ModelSerializer):
    """Read representation of an application.

    ``internal_notes`` is recruiter-only and is removed from the payload when
    the request is made by a student.
    """

    student_name = serializers.CharField(source="student.user.full_name", read_only=True)
    student_roll_number = serializers.CharField(source="student.roll_number", read_only=True)
    student_cgpa = serializers.DecimalField(
        source="student.cgpa", max_digits=4, decimal_places=2, read_only=True
    )
    student_department = serializers.CharField(
        source="student.department.name", read_only=True
    )
    student_backlogs = serializers.IntegerField(
        source="student.active_backlogs", read_only=True
    )
    job_drive_title = serializers.CharField(source="job_drive.title", read_only=True)
    job_drive_company = serializers.CharField(source="job_drive.company.name", read_only=True)
    job_drive_company_id = serializers.IntegerField(source="job_drive.company_id", read_only=True)
    job_drive_role = serializers.CharField(source="job_drive.role_designation", read_only=True)
    job_drive_deadline = serializers.DateTimeField(
        source="job_drive.application_deadline", read_only=True
    )
    interview_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "student",
            "student_name",
            "student_roll_number",
            "student_cgpa",
            "student_department",
            "student_backlogs",
            "job_drive",
            "job_drive_title",
            "job_drive_company",
            "job_drive_company_id",
            "job_drive_role",
            "job_drive_deadline",
            "status",
            "applied_at",
            "status_changed_at",
            "shortlisted_at",
            "selected_at",
            "withdrawn_at",
            "offer_package",
            "rejection_reason",
            "internal_notes",
            "resume_url",
            "eligibility_snapshot",
            "interview_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def to_representation(self, instance):
        """Hide recruiter-only fields from students."""
        data = super().to_representation(instance)
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and user.is_student:
            data.pop("internal_notes", None)
        return data


class ApplicationCreateSerializer(serializers.Serializer):
    """Payload used by a student to submit an application."""

    job_drive = serializers.PrimaryKeyRelatedField(queryset=JobDrive.objects.all())
    resume_url = serializers.URLField(max_length=500, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        """Reject applying to a drive that is not open."""
        from django.utils import timezone

        drive = attrs["job_drive"]
        if drive.status != drive.Status.PUBLISHED:
            raise serializers.ValidationError(
                {"job_drive": "Applications are not open for this placement drive."}
            )
        if drive.application_deadline <= timezone.now():
            raise serializers.ValidationError(
                {"job_drive": "The application deadline for this drive has passed."}
            )
        return attrs


class ApplicationStatusChangeSerializer(serializers.Serializer):
    """Payload used to move an application through the recruitment pipeline."""

    new_status = serializers.ChoiceField(choices=Application.Status.choices)
    reason = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")
    offer_package = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True, min_value=0
    )

    def validate_new_status(self, value):
        """Reject transitions into a terminal state chosen by a student."""
        return value


class ApplicationNoteSerializer(serializers.Serializer):
    """Payload used by recruiters to annotate an application."""

    internal_notes = serializers.CharField(max_length=2000, required=False, allow_blank=True)
