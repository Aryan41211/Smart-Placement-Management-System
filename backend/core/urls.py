"""URL routing for the core app."""

from __future__ import annotations

from django.urls import path

from core import views

app_name = "core"

urlpatterns = [
    path("health/", views.HealthCheckView.as_view(), name="health"),
]
