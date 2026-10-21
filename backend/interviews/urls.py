"""URL routing for the interviews app (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from interviews import views

app_name = "interviews"

router = SimpleRouter()
router.register("interviews", views.InterviewViewSet, basename="interview")
router.register("my-interviews", views.MyInterviewListView, basename="my-interview")

urlpatterns = [
    path("", include(router.urls)),
]
