"""URL routing for recruiter administration (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from companies import views

app_name = "recruiters"

router = SimpleRouter()
router.register("recruiters", views.RecruiterViewSet, basename="recruiter")

urlpatterns = [
    path("", include(router.urls)),
]
