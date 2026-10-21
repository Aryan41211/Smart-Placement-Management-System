"""Academic reference data for the college."""

from __future__ import annotations

from django.db import models


class Department(models.Model):
    """An academic department (or branch) of the institution.

    Keeping departments in a table (instead of a free-text column) gives us
    real referential integrity, lets job drives restrict eligibility with a
    foreign key, and removes spelling drift from department-wise reports.
    """

    code = models.CharField(max_length=16, unique=True, db_index=True)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    annual_intake = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "departments"
        ordering = ["name"]
        verbose_name = "Department"
        verbose_name_plural = "Departments"

    def __str__(self) -> str:  # pragma: no cover - human readable helper
        return f"{self.code} - {self.name}"
