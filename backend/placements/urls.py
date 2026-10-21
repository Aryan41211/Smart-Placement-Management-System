"""URL routing for the placements app (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from placements import views

app_name = "placements"

router = SimpleRouter()
router.register("drives", views.JobDriveViewSet, basename="job-drive")

urlpatterns = [
    path("", include(router.urls)),
]
