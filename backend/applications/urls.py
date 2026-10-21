"""URL routing for the applications app (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from applications import views

app_name = "applications"

router = SimpleRouter()
router.register("applications", views.ApplicationViewSet, basename="application")
router.register("my-applications", views.MyApplicationListView, basename="my-application")
router.register("application-summary", views.ApplicationSummaryView, basename="application-summary")

urlpatterns = [
    path("", include(router.urls)),
]
