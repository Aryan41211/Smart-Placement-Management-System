"""URL routing for the notifications app (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from notifications import views

app_name = "notifications"

router = SimpleRouter()
router.register("notifications", views.NotificationViewSet, basename="notification")
router.register("notification-stats", views.NotificationStatsView, basename="notification-stats")

urlpatterns = [
    path("", include(router.urls)),
]
