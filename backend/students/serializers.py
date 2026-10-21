"""Serializers for the student directory and student skills."""

from __future__ import annotations

from rest_framework import serializers

from accounts.models import StudentProfile
from placements.models import Skill, StudentSkill


class SkillSerializer(serializers.ModelSerializer):
    """Read/write representation of a skill tag."""

    class Meta:
        model = Skill
        fields = ("id", "name", "slug", "category")
        read_only_fields = ("id", "slug")

    def validate_name(self, value):
        """Reject duplicate skill names (case-insensitive)."""
        qs = Skill.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A skill with this name already exists.")
        return value


class StudentSkillSerializer(serializers.ModelSerializer):
    """Read/write representation of a skill attached to a student."""

    id = serializers.IntegerField(read_only=True)
    skill = serializers.PrimaryKeyRelatedField(queryset=Skill.objects.all())
    skill_name = serializers.CharField(source="skill.name", read_only=True)

    class Meta:
        model = StudentSkill
        fields = ("id", "skill", "skill_name", "proficiency_level", "is_certified")
        read_only_fields = ("id", "skill_name")

    def validate(self, attrs):
        """Reject a duplicate skill entry for the same student."""
        student = self.context["student"]
        skill = attrs.get("skill") or getattr(self.instance, "skill", None)
        qs = StudentSkill.objects.filter(student=student, skill=skill)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This skill is already listed on the profile.")
        return attrs


class StudentDirectorySerializer(serializers.ModelSerializer):
    """Compact student record used by the administrative directory."""

    full_name = serializers.CharField(source="user.full_name", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    application_count = serializers.IntegerField(read_only=True)
    placed = serializers.BooleanField(read_only=True)

    class Meta:
        model = StudentProfile
        fields = (
            "id",
            "roll_number",
            "full_name",
            "email",
            "department",
            "department_code",
            "department_name",
            "cgpa",
            "active_backlogs",
            "graduation_year",
            "current_semester",
            "phone",
            "is_profile_complete",
            "application_count",
            "placed",
            "created_at",
        )
        read_only_fields = fields


class MyProfileSerializer(serializers.ModelSerializer):
    """Full editable profile of the authenticated student."""

    user = serializers.SerializerMethodField()
    department_code = serializers.CharField(source="department.code", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = StudentProfile
        fields = (
            "id",
            "user",
            "roll_number",
            "department",
            "department_code",
            "department_name",
            "cgpa",
            "active_backlogs",
            "graduation_year",
            "current_semester",
            "phone",
            "resume_url",
            "portfolio_url",
            "linkedin_url",
            "bio",
            "is_profile_complete",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "roll_number", "is_profile_complete", "created_at", "updated_at")

    def get_user(self, obj):
        """Return the read-only account fields of the owning user."""
        return {
            "id": obj.user_id,
            "email": obj.user.email,
            "full_name": obj.user.full_name,
            "phone": obj.user.phone,
        }

    def validate_cgpa(self, value):
        """Reject CGPA values outside the 0.00 - 10.00 range."""
        if value < 0 or value > 10:
            raise serializers.ValidationError("CGPA must be between 0.00 and 10.00.")
        return value

    def validate_active_backlogs(self, value):
        """Reject a negative backlog count."""
        if value < 0:
            raise serializers.ValidationError("Active backlogs cannot be negative.")
        return value
