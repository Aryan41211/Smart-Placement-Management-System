"""URL routing for the companies app (mounted under ``/api/v1/``)."""

from __future__ import annotations

from django.urls import include, path
from rest_framework.routers import SimpleRouter

from companies import views

app_name = "companies"

router = SimpleRouter()
router.register("companies", views.CompanyViewSet, basename="company")

urlpatterns = [
    path("", include(router.urls)),
]
