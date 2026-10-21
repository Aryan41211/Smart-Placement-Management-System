"""URL routing for the shared skill taxonomy."""

from __future__ import annotations

from django.urls import path

from students import views

app_name = "skills"

urlpatterns = [
    path("", views.SkillListCreateView.as_view(), name="skill-list"),
]
