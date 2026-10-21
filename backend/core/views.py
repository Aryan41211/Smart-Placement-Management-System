"""Health-check and service metadata endpoints."""

from __future__ import annotations

from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """``GET /api/v1/health/`` - verifies that the API and database are up."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        """Report API and database connectivity."""
        database_ok = True
        database_error = None
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT VERSION();")
                row = cursor.fetchone()
                server_version = row[0] if row else "unknown"
        except Exception as exc:  # pragma: no cover - depends on live DB
            database_ok = False
            server_version = None
            database_error = str(exc)

        payload = {
            "status": "ok" if database_ok else "degraded",
            "service": "smart-placement-management-system",
            "version": "1.0.0",
            "server_time": timezone.now().isoformat(),
            "database": {
                "connected": database_ok,
                "engine": connection.vendor,
                "server_version": server_version,
                "error": database_error,
            },
        }
        code = status.HTTP_200_OK if database_ok else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(payload, status=code)
