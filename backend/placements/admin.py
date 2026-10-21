"""Django admin registrations for the placements app."""

from __future__ import annotations

from django.contrib import admin

from placements.models import JobDrive, JobDriveSkill, Skill, StudentSkill


class JobDriveSkillInline(admin.TabularInline):
    """Inline editor for the skills required by a drive."""

    model = JobDriveSkill
    extra = 1


@admin.register(JobDrive)
class JobDriveAdmin(admin.ModelAdmin):
    """Admin view for placement drives."""

    list_display = ("title", "company", "status", "application_deadline", "min_cgpa")
    list_filter = ("status", "job_type", "drive_mode", "company")
    search_fields = ("title", "role_designation", "company__name")
    filter_horizontal = ("allowed_departments",)
    inlines = [JobDriveSkillInline]
    date_hierarchy = "application_deadline"


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    """Admin view for the skill taxonomy."""

    list_display = ("name", "category")
    search_fields = ("name", "category")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(StudentSkill)
class StudentSkillAdmin(admin.ModelAdmin):
    """Admin view for student skills."""

    list_display = ("student", "skill", "proficiency_level", "is_certified")
    list_filter = ("skill", "is_certified")
    search_fields = ("student__roll_number", "student__user__full_name", "skill__name")


@admin.register(JobDriveSkill)
class JobDriveSkillAdmin(admin.ModelAdmin):
    """Admin view for drive skill requirements."""

    list_display = ("job_drive", "skill", "requirement_level", "min_proficiency")
    list_filter = ("requirement_level", "skill")
