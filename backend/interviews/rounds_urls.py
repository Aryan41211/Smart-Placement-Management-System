"""URL routing for interview rounds (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from interviews import views

app_name = "rounds"

router = SimpleRouter()
router.register("rounds", views.InterviewRoundViewSet, basename="interview-round")

urlpatterns = [
    path("", include(router.urls)),
]
