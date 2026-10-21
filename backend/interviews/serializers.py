"""Serializers for interview rounds and scheduled interviews."""

from __future__ import annotations

from rest_framework import serializers

from applications.models import Application
from interviews.models import Interview, InterviewRound


class InterviewRoundSerializer(serializers.ModelSerializer):
    """Read/write representation of a drive's interview round."""

    job_drive_title = serializers.CharField(source="job_drive.title", read_only=True)
    job_drive_company = serializers.CharField(source="job_drive.company.name", read_only=True)
    interview_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = InterviewRound
        fields = (
            "id",
            "job_drive",
            "job_drive_title",
            "job_drive_company",
            "name",
            "sequence",
            "description",
            "is_active",
            "interview_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class InterviewSerializer(serializers.ModelSerializer):
    """Read/write representation of a scheduled interview."""

    student_name = serializers.CharField(source="application.student.user.full_name", read_only=True)
    student_roll_number = serializers.CharField(source="application.student.roll_number", read_only=True)
    student_cgpa = serializers.DecimalField(
        source="application.student.cgpa", max_digits=4, decimal_places=2, read_only=True
    )
    student_department = serializers.CharField(
        source="application.student.department.name", read_only=True
    )
    round_name = serializers.CharField(source="round.name", read_only=True)
    round_sequence = serializers.IntegerField(source="round.sequence", read_only=True)
    job_drive = serializers.IntegerField(source="round.job_drive_id", read_only=True)
    job_drive_title = serializers.CharField(source="round.job_drive.title", read_only=True)
    job_drive_company = serializers.CharField(source="round.job_drive.company.name", read_only=True)
    job_drive_company_id = serializers.IntegerField(source="round.job_drive.company_id", read_only=True)
    application_status = serializers.CharField(source="application.status", read_only=True)

    class Meta:
        model = Interview
        fields = (
            "id",
            "application",
            "application_status",
            "student_name",
            "student_roll_number",
            "student_cgpa",
            "student_department",
            "round",
            "round_name",
            "round_sequence",
            "job_drive",
            "job_drive_title",
            "job_drive_company",
            "job_drive_company_id",
            "scheduled_at",
            "duration_minutes",
            "mode",
            "venue",
            "meeting_link",
            "status",
            "outcome",
            "feedback",
            "completed_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "completed_at", "created_at", "updated_at")


class InterviewCreateSerializer(serializers.ModelSerializer):
    """Payload used to schedule an interview for an application."""

    class Meta:
        model = Interview
        fields = (
            "application",
            "round",
            "scheduled_at",
            "duration_minutes",
            "mode",
            "venue",
            "meeting_link",
        )

    def validate(self, attrs):
        """Validate the schedule against the application and round."""
        application = attrs.get("application")
        round_obj = attrs.get("round")
        if application is None or round_obj is None:
            return attrs
        if application.job_drive_id != round_obj.job_drive_id:
            raise serializers.ValidationError(
                {"round": "The interview round does not belong to the application's drive."}
            )
        if application.status not in {
            Application.Status.SHORTLISTED,
            Application.Status.INTERVIEW,
            Application.Status.APPLIED,
            Application.Status.UNDER_REVIEW,
        }:
            raise serializers.ValidationError(
                {
                    "application": (
                        "Interviews can only be scheduled for applications that are "
                        "still in the active pipeline."
                    )
                }
            )
        return attrs


class InterviewOutcomeSerializer(serializers.Serializer):
    """Payload used to record the result of an interview."""

    status = serializers.ChoiceField(
        choices=Interview.Status.choices, required=False, default=Interview.Status.COMPLETED
    )
    outcome = serializers.ChoiceField(choices=Interview.Outcome.choices)
    feedback = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
