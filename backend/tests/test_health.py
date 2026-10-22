"""Tests for the public health-check endpoint."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


def test_health_endpoint_reports_the_database(api_client):
    """`GET /api/v1/health/` is public and reports live database connectivity.

    Regression test: the route was previously mounted twice
    (`/api/v1/health/health/`), so the documented URL returned 404.
    """
    response = api_client.get("/api/v1/health/")
    assert response.status_code == 200, response.data

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "smart-placement-management-system"
    assert body["database"]["connected"] is True
    assert body["database"]["engine"] == "mysql"
    assert body["database"]["server_version"]
