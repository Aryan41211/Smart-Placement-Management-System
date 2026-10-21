"""Serializers for authentication, users and profiles."""

from __future__ import annotations

from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from rest_framework import serializers

from accounts.models import RecruiterProfile, StudentProfile, User
from students.models import Department


class UserSerializer(serializers.ModelSerializer):
    """Read-only representation of an account."""

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "role", "phone", "is_active", "date_joined")
        read_only_fields = fields


class StudentProfileSerializer(serializers.ModelSerializer):
    """Read/write representation of a student's academic profile."""

    user = UserSerializer(read_only=True)
    department_code = serializers.CharField(source="department.code", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    skills = serializers.SerializerMethodField()

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
            "skills",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "user", "is_profile_complete", "created_at", "updated_at")

    def get_skills(self, obj) -> list[dict]:
        """Return the student's skills as a compact list."""
        return [
            {
                "id": link.id,
                "name": link.skill.name,
                "category": link.skill.category,
                "proficiency_level": link.proficiency_level,
                "is_certified": link.is_certified,
            }
            for link in obj.skills.select_related("skill").all()
        ]


class StudentProfileWriteSerializer(serializers.ModelSerializer):
    """Writable subset of the student profile used by ``PATCH /students/me``."""

    class Meta:
        model = StudentProfile
        fields = (
            "department",
            "cgpa",
            "active_backlogs",
            "graduation_year",
            "current_semester",
            "phone",
            "resume_url",
            "portfolio_url",
            "linkedin_url",
            "bio",
        )

    def validate_cgpa(self, value):
        """Reject CGPA values outside the 0.00 - 10.00 range."""
        if value is None or value < 0 or value > 10:
            raise serializers.ValidationError("CGPA must be between 0.00 and 10.00.")
        return value

    def validate_graduation_year(self, value):
        """Reject implausible graduation years."""
        if value < 1950 or value > 2200:
            raise serializers.ValidationError("Enter a valid graduation year.")
        return value


class RecruiterProfileSerializer(serializers.ModelSerializer):
    """Read representation of a recruiter's company authorisation."""

    user = UserSerializer(read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = RecruiterProfile
        fields = (
            "id",
            "user",
            "company",
            "company_name",
            "designation",
            "phone",
            "is_authorized",
            "can_post_jobs",
        )
        read_only_fields = fields


class StudentRegistrationSerializer(serializers.Serializer):
    """Create a student account together with its academic profile."""

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})
    roll_number = serializers.CharField(max_length=20)
    department = serializers.PrimaryKeyRelatedField(queryset=Department.objects.filter(is_active=True))
    cgpa = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=0, max_value=10)
    active_backlogs = serializers.IntegerField(min_value=0, max_value=50, required=False, default=0)
    graduation_year = serializers.IntegerField(min_value=1950, max_value=2200)
    current_semester = serializers.IntegerField(min_value=1, max_value=12, required=False, default=1)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")

    def validate_email(self, value):
        """Ensure the e-mail address is not already registered."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this e-mail already exists.")
        return value.lower()

    def validate_roll_number(self, value):
        """Ensure the roll number is unique across the institution."""
        if StudentProfile.objects.filter(roll_number__iexact=value).exists():
            raise serializers.ValidationError("This roll number is already registered.")
        return value

    def validate(self, attrs):
        """Validate the password pair and password strength."""
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        """Create the user and the student profile in a single transaction."""
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User.objects.create_user(
            email=validated_data.pop("email"),
            password=password,
            full_name=validated_data.pop("full_name"),
            role=User.Role.STUDENT,
            phone=validated_data.pop("phone", ""),
        )
        profile = StudentProfile.objects.create(user=user, **validated_data)
        return profile


class ChangePasswordSerializer(serializers.Serializer):
    """Change the password of the authenticated account."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        """Verify the supplied current password."""
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate_new_password(self, value):
        """Validate the strength of the new password."""
        validate_password(value, user=self.context["request"].user)
        return value

    def save(self, **kwargs):
        """Persist the new password."""
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


class LoginSerializer(serializers.Serializer):
    """Validate login credentials."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        """Authenticate the user and reject inactive accounts."""
        from django.contrib.auth import authenticate

        user = authenticate(
            request=self.context.get("request"),
            username=attrs["email"].lower(),
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Invalid e-mail address or password.")
        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")
        attrs["user"] = user
        return attrs


class MeSerializer(serializers.ModelSerializer):
    """Composite payload describing the authenticated user."""

    student_profile = serializers.SerializerMethodField()
    recruiter_profile = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "role",
            "phone",
            "date_joined",
            "student_profile",
            "recruiter_profile",
            "permissions",
        )
        read_only_fields = fields

    def get_student_profile(self, obj):
        """Return the student's profile when the account has one."""
        profile = getattr(obj, "student_profile", None)
        if profile is None:
            return None
        return {
            "id": profile.id,
            "roll_number": profile.roll_number,
            "department": profile.department_id,
            "department_code": profile.department.code,
            "department_name": profile.department.name,
            "cgpa": profile.cgpa,
            "active_backlogs": profile.active_backlogs,
            "graduation_year": profile.graduation_year,
            "current_semester": profile.current_semester,
            "phone": profile.phone,
            "resume_url": profile.resume_url,
            "portfolio_url": profile.portfolio_url,
            "linkedin_url": profile.linkedin_url,
            "bio": profile.bio,
            "is_profile_complete": profile.is_profile_complete,
        }

    def get_recruiter_profile(self, obj):
        """Return the recruiter's company authorisation when present."""
        profile = getattr(obj, "recruiter_profile", None)
        if profile is None:
            return None
        return {
            "id": profile.id,
            "company": profile.company_id,
            "company_name": profile.company.name if profile.company else None,
            "designation": profile.designation,
            "phone": profile.phone,
            "is_authorized": profile.is_authorized,
            "can_post_jobs": profile.can_post_jobs,
        }

    def get_permissions(self, obj):
        """Return the coarse capability list used by the frontend router."""
        if obj.is_admin:
            return ["admin", "manage_students", "manage_drives", "view_reports", "export_reports"]
        if obj.is_recruiter:
            return ["recruiter", "manage_own_drives", "view_applicants", "schedule_interviews"]
        return ["student", "apply", "track_applications", "view_drives"]
