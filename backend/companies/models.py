"""Companies that participate in the placement process."""

from __future__ import annotations

from django.db import models
from django.utils.text import slugify

from core.models import TimeStampedModel


class Company(TimeStampedModel):
    """A recruiting organisation.

    The ``is_active`` flag lets the placement cell retire a company without
    losing the historical application records that reference it.
    """

    class Industry(models.TextChoices):
        INFORMATION_TECHNOLOGY = "it", "Information Technology"
        IT_SERVICES = "it_services", "IT Services"
        PRODUCT = "product", "Product & Startup"
        CONSULTING = "consulting", "Consulting"
        FINANCE = "finance", "Finance & Banking"
        AUTOMOTIVE = "automotive", "Automotive"
        HEALTHCARE = "healthcare", "Healthcare"
        TELECOM = "telecom", "Telecom"
        ENERGY = "energy", "Energy"
        EDUCATION = "education", "Education"
        OTHER = "other", "Other"

    name = models.CharField(max_length=180, unique=True, db_index=True)
    slug = models.SlugField(max_length=200, unique=True)
    industry = models.CharField(
        max_length=32, choices=Industry.choices, default=Industry.OTHER, db_index=True
    )
    website = models.URLField(max_length=300, blank=True)
    logo_url = models.URLField(max_length=500, blank=True)
    location = models.CharField(max_length=180, blank=True)
    description = models.TextField(blank=True)
    hr_contact_email = models.EmailField(blank=True)
    hr_contact_phone = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="companies_created",
    )

    class Meta:
        db_table = "companies"
        ordering = ["name"]
        verbose_name = "Company"
        verbose_name_plural = "Companies"
        indexes = [
            models.Index(fields=["is_active", "industry"], name="company_active_industry_idx"),
        ]

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return self.name

    def save(self, *args, **kwargs):
        """Keep the slug in sync with the company name."""
        if not self.slug:
            self.slug = slugify(self.name)[:200] or "company"
        super().save(*args, **kwargs)
