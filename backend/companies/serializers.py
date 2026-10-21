"""Serializers for companies and recruiter management."""

from __future__ import annotations

from rest_framework import serializers

from accounts.models import RecruiterProfile, User
from companies.models import Company


class CompanySerializer(serializers.ModelSerializer):
    """Read representation of a company."""

    recruiter_count = serializers.IntegerField(read_only=True)
    drive_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = (
            "id",
            "name",
            "slug",
            "industry",
            "website",
            "logo_url",
            "location",
            "description",
            "hr_contact_email",
            "hr_contact_phone",
            "is_active",
            "recruiter_count",
            "drive_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "slug", "created_at", "updated_at")


class CompanyWriteSerializer(serializers.ModelSerializer):
    """Create/update payload for a company."""

    class Meta:
        model = Company
        fields = (
            "id",
            "name",
            "industry",
            "website",
            "logo_url",
            "location",
            "description",
            "hr_contact_email",
            "hr_contact_phone",
            "is_active",
        )
        read_only_fields = ("id",)

    def validate_name(self, value):
        """Reject duplicate company names (case-insensitive)."""
        qs = Company.objects.filter(name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A company with this name already exists.")
        return value


class RecruiterSerializer(serializers.ModelSerializer):
    """Read representation of a recruiter account."""

    email = serializers.CharField(source="user.email", read_only=True)
    full_name = serializers.CharField(source="user.full_name", read_only=True)
    phone = serializers.CharField(source="user.phone", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True)

    class Meta:
        model = RecruiterProfile
        fields = (
            "id",
            "user",
            "email",
            "full_name",
            "phone",
            "company",
            "company_name",
            "designation",
            "is_authorized",
            "can_post_jobs",
            "created_at",
        )
        read_only_fields = fields


class RecruiterProvisionSerializer(serializers.Serializer):
    """Payload used by the placement cell to provision a recruiter account."""

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.all())
    designation = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    phone = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default=""
    )
    is_authorized = serializers.BooleanField(required=False, default=True)
    can_post_jobs = serializers.BooleanField(required=False, default=True)

    def validate_email(self, value):
        """Reject an e-mail address that is already registered."""
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this e-mail already exists.")
        return value.lower()

    def validate_password(self, value):
        """Validate the strength of the supplied password."""
        from django.contrib.auth.password_validation import validate_password

        validate_password(value)
        return value

    def create(self, validated_data):
        """Create the recruiter account and its company authorisation."""
        password = validated_data.pop("password")
        company = validated_data.pop("company")
        email = validated_data.pop("email")
        full_name = validated_data.pop("full_name")
        user = User.objects.create_user(
            email=email,
            password=password,
            full_name=full_name,
            role=User.Role.RECRUITER,
            phone=validated_data.get("phone", "") or "",
        )
        profile = RecruiterProfile.objects.create(user=user, company=company, **validated_data)
        return profile
