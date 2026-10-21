"""Account models: users, student profiles and recruiter profiles.

The project uses a custom user model so that the *role* is a first class
database attribute rather than something inferred in application code. Role
membership is enforced on the backend through DRF permission classes.
"""

from __future__ import annotations

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel


class UserManager(BaseUserManager):
    """Manager for :class:`User` with e-mail based credential handling."""

    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields):
        """Create a regular (non staff) user."""
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields):
        """Create an administrator account."""
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.ADMIN)
        extra_fields.setdefault("full_name", "Placement Officer")
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, username):
        return self.get(**{self.model.USERNAME_FIELD: username})


def validate_roll_number(value: str) -> None:
    """Validate a student roll number (2-20 alphanumeric characters)."""
    RegexValidator(
        regex=r"^[A-Za-z0-9]{2,20}$",
        message="Roll number must be 2-20 letters or digits with no spaces.",
    )(value)


class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    """A placement cell account.

    ``email`` is the login identifier. Only students may self-register; admin
    and recruiter accounts are provisioned by the placement cell.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Placement Officer"
        STUDENT = "student", "Student"
        RECRUITER = "recruiter", "Recruiter"

    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT, db_index=True)
    phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        db_table = "users"
        ordering = ["full_name", "email"]
        indexes = [
            models.Index(fields=["role", "is_active"], name="user_role_active_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.full_name} <{self.email}>"

    def get_full_name(self) -> str:
        """Return the user's display name."""
        return self.full_name

    def get_short_name(self) -> str:
        """Return the first token of the display name."""
        return self.full_name.split(" ")[0]

    @property
    def is_admin(self) -> bool:
        """True when the account holds placement-officer privileges."""
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_student(self) -> bool:
        """True when the account is a student account."""
        return self.role == self.Role.STUDENT

    @property
    def is_recruiter(self) -> bool:
        """True when the account is a recruiter account."""
        return self.role == self.Role.RECRUITER


class StudentProfile(TimeStampedModel):
    """Academic details owned by a student account."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="student_profile")
    roll_number = models.CharField(
        max_length=20, unique=True, db_index=True, validators=[validate_roll_number]
    )
    department = models.ForeignKey(
        "students.Department", on_delete=models.PROTECT, related_name="students"
    )
    cgpa = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text="Cumulative Grade Point Average on a 0.00 - 10.00 scale.",
    )
    active_backlogs = models.PositiveIntegerField(
        default=0, help_text="Number of currently active backlogs."
    )
    graduation_year = models.PositiveIntegerField(db_index=True)
    current_semester = models.PositiveSmallIntegerField(default=1)
    phone = models.CharField(max_length=20, blank=True)
    resume_url = models.URLField(
        max_length=500, blank=True, help_text="Link to an externally hosted resume (PDF)."
    )
    portfolio_url = models.URLField(max_length=300, blank=True)
    linkedin_url = models.URLField(max_length=300, blank=True)
    bio = models.TextField(max_length=1000, blank=True)
    is_profile_complete = models.BooleanField(
        default=False,
        help_text="Set by the application when the mandatory academic fields are present.",
    )

    class Meta:
        db_table = "student_profiles"
        ordering = ["roll_number"]
        verbose_name = "Student profile"
        verbose_name_plural = "Student profiles"
        indexes = [
            models.Index(fields=["department", "graduation_year"], name="student_dept_year_idx"),
            models.Index(fields=["cgpa"], name="student_cgpa_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.roll_number} - {self.user.full_name}"

    def save(self, *args, **kwargs):
        """Keep the ``is_profile_complete`` flag in sync with the data."""
        super().save(*args, **kwargs)
        expected = bool(self.roll_number and self.department_id and self.graduation_year)
        if expected != self.is_profile_complete:
            StudentProfile.objects.filter(pk=self.pk).update(is_profile_complete=expected)

    @property
    def has_backlogs(self) -> bool:
        """True when the student has at least one active backlog."""
        return self.active_backlogs > 0


class RecruiterProfile(TimeStampedModel):
    """Company-side profile owned by a recruiter account."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="recruiter_profile")
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.PROTECT,
        related_name="recruiters",
        null=True,
        blank=True,
        help_text="Company the recruiter is authorised to represent.",
    )
    designation = models.CharField(max_length=120, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    is_authorized = models.BooleanField(
        default=False, help_text="Approved by the placement cell to manage drives."
    )
    can_post_jobs = models.BooleanField(
        default=True, help_text="Allowed to create draft job postings."
    )

    class Meta:
        db_table = "recruiter_profiles"
        ordering = ["user__full_name"]
        verbose_name = "Recruiter profile"
        verbose_name_plural = "Recruiter profiles"
        indexes = [
            models.Index(fields=["company", "is_authorized"], name="recruiter_company_auth_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.user.full_name} @ {self.company.name if self.company else 'Unassigned'}"
