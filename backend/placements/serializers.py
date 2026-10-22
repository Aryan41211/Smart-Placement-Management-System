"""Serializers for job drives, drive skills and eligibility output."""

from __future__ import annotations

from django.utils import timezone
from rest_framework import serializers

from placements.models import JobDrive, JobDriveSkill, Skill
from placements.services import evaluate_eligibility
from students.models import Department


class JobDriveSkillSerializer(serializers.ModelSerializer):
    """Read representation of a skill requirement on a drive."""

    skill = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all())
    skill_id = serializers.IntegerField(source="skill.id", read_only=True)
    skill_name = serializers.CharField(source="skill.name", read_only=True)

    class Meta:
        model = JobDriveSkill
        fields = ("id", "skill", "skill_id", "skill_name", "requirement_level", "min_proficiency")
        read_only_fields = ("id", "skill_id", "skill_name")


class JobDriveSerializer(serializers.ModelSerializer):
    """Read representation of a placement drive."""

    company_name = serializers.CharField(source="company.name", read_only=True)
    company_industry = serializers.CharField(source="company.industry", read_only=True)
    required_skills = JobDriveSkillSerializer(many=True, read_only=True)
    allowed_departments = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    allowed_department_names = serializers.SerializerMethodField()
    is_open = serializers.BooleanField(read_only=True)
    days_to_deadline = serializers.IntegerField(read_only=True)
    application_count = serializers.IntegerField(read_only=True)
    created_by_name = serializers.CharField(source="created_by.full_name", read_only=True)

    class Meta:
        model = JobDrive
        fields = (
            "id",
            "title",
            "company",
            "company_name",
            "company_industry",
            "role_designation",
            "description",
            "job_type",
            "drive_mode",
            "package_min",
            "package_max",
            "min_cgpa",
            "max_active_backlogs",
            "allowed_departments",
            "allowed_department_names",
            "min_graduation_year",
            "max_graduation_year",
            "application_deadline",
            "published_at",
            "submitted_at",
            "status",
            "eligibility_notes",
            "required_skills",
            "is_open",
            "days_to_deadline",
            "application_count",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "published_at",
            "submitted_at",
            "created_at",
            "updated_at",
            "created_by_name",
        )

    def get_allowed_department_names(self, obj) -> list[str]:
        """Return the names of the departments allowed to apply."""
        return list(obj.allowed_departments.values_list("name", flat=True))


class JobDriveWriteSerializer(serializers.ModelSerializer):
    """Create/update payload for a placement drive."""

    required_skills = JobDriveSkillSerializer(many=True, required=False)

    class Meta:
        model = JobDrive
        fields = (
            "id",
            "title",
            "company",
            "role_designation",
            "description",
            "job_type",
            "drive_mode",
            "package_min",
            "package_max",
            "min_cgpa",
            "max_active_backlogs",
            "allowed_departments",
            "min_graduation_year",
            "max_graduation_year",
            "application_deadline",
            "eligibility_notes",
            "required_skills",
            "status",
        )
        read_only_fields = ("id",)

    def validate_title(self, value):
        """Reject an empty or whitespace-only title."""
        if not value.strip():
            raise serializers.ValidationError("A drive title is required.")
        return value.strip()

    def validate_min_cgpa(self, value):
        """Reject a CGPA requirement outside the 0.00 - 10.00 range."""
        if value is not None and (value < 0 or value > 10):
            raise serializers.ValidationError("Minimum CGPA must be between 0.00 and 10.00.")
        return value

    def validate_package_min(self, value):
        """Reject a negative package value."""
        if value is None or value < 0:
            raise serializers.ValidationError("Package cannot be negative.")
        return value

    def validate(self, attrs):
        """Validate cross-field rules for a drive."""
        package_min = attrs.get("package_min", getattr(self.instance, "package_min", 0))
        package_max = attrs.get("package_max", getattr(self.instance, "package_max", 0))
        if package_max < package_min:
            raise serializers.ValidationError(
                {"package_max": "The maximum package cannot be lower than the minimum package."}
            )

        min_year = attrs.get("min_graduation_year", getattr(self.instance, "min_graduation_year", None))
        max_year = attrs.get("max_graduation_year", getattr(self.instance, "max_graduation_year", None))
        if min_year is not None and max_year is not None and max_year < min_year:
            raise serializers.ValidationError(
                {"max_graduation_year": "The latest graduation year cannot be lower than the earliest."}
            )

        deadline = attrs.get(
            "application_deadline", getattr(self.instance, "application_deadline", None)
        )
        if deadline and deadline <= timezone.now():
            raise serializers.ValidationError(
                {"application_deadline": "The application deadline must be in the future."}
            )
        return attrs

    def create(self, validated_data):
        """Create the drive together with its departments and skill requirements.

        ``allowed_departments`` is a many-to-many relation, so it must be
        removed from the keyword arguments passed to ``objects.create()`` and
        set on the instance afterwards - assigning it directly raises
        ``TypeError``.
        """
        departments = validated_data.pop("allowed_departments", [])
        skills = validated_data.pop("required_skills", [])
        drive = JobDrive.objects.create(**validated_data)
        if departments:
            drive.allowed_departments.set(departments)
        self._save_skills(drive, skills)
        return drive

    def update(self, instance, validated_data):
        """Update the drive and synchronise its departments and skills."""
        departments = validated_data.pop("allowed_departments", None)
        skills = validated_data.pop("required_skills", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if departments is not None:
            instance.allowed_departments.set(departments)
        if skills is not None:
            instance.required_skills.all().delete()
            self._save_skills(instance, skills)
        return instance

    def _save_skills(self, drive, skills):
        """Persist the nested skill requirement rows."""
        for entry in skills:
            skill = entry.get("skill")
            if skill is None:
                continue
            JobDriveSkill.objects.update_or_create(
                job_drive=drive,
                skill=skill,
                defaults={
                    "requirement_level": entry.get("requirement_level", "required"),
                    "min_proficiency": entry.get("min_proficiency", 1),
                },
            )


class EligibilitySerializer(serializers.Serializer):
    """Serialised eligibility decision for one student and one drive."""

    eligible = serializers.BooleanField()
    reasons = serializers.ListField(child=serializers.CharField())
    messages = serializers.ListField(child=serializers.CharField())
    details = serializers.DictField()

    @staticmethod
    def build(student, drive) -> dict:
        """Evaluate and serialise the eligibility of ``student`` for ``drive``."""
        return evaluate_eligibility(student, drive).as_dict()
