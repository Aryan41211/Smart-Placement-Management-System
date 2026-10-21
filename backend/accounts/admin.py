"""Django admin registrations for the accounts app."""

from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from accounts.models import RecruiterProfile, StudentProfile, User


class UserCreationFormWithRole(UserCreationForm):
    """Creation form that also captures the role."""

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ("email", "full_name", "role")


class UserChangeFormWithRole(UserChangeForm):
    """Change form that also captures the role."""

    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin view for the custom user model."""

    add_form = UserCreationFormWithRole
    form = UserChangeFormWithRole
    model = User
    list_display = ("email", "full_name", "role", "is_active", "date_joined")
    list_filter = ("role", "is_active", "is_staff")
    search_fields = ("email", "full_name")
    ordering = ("email",)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("full_name", "role", "phone")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "role", "password1", "password2"),
            },
        ),
    )


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    """Admin view for student academic records."""

    list_display = ("roll_number", "user", "department", "cgpa", "active_backlogs", "graduation_year")
    list_filter = ("department", "graduation_year")
    search_fields = ("roll_number", "user__full_name", "user__email")
    list_select_related = ("user", "department")


@admin.register(RecruiterProfile)
class RecruiterProfileAdmin(admin.ModelAdmin):
    """Admin view for recruiter authorisation."""

    list_display = ("user", "company", "designation", "is_authorized", "can_post_jobs")
    list_filter = ("is_authorized", "can_post_jobs", "company")
    search_fields = ("user__full_name", "user__email", "company__name")
    list_select_related = ("user", "company")
