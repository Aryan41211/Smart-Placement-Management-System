"""Uniform API error handling.

Every error returned by the API uses the same JSON envelope so the frontend
can render a single error component::

    {
      "error": {
        "code": "validation_error",
        "message": "Request payload is invalid.",
        "details": {"cgpa": ["Ensure this value is less than or equal to 10.00."]}
      }
    }

Internal stack traces are never exposed to clients.
"""

from __future__ import annotations

import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed, ValidationError as DRFValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

try:  # pragma: no cover - the dependency is always installed
    from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
except Exception:  # pragma: no cover
    class InvalidToken(Exception):  # type: ignore[no-redef]
        """Fallback when simplejwt is unavailable."""

    class TokenError(Exception):  # type: ignore[no-redef]
        """Fallback when simplejwt is unavailable."""

logger = logging.getLogger(__name__)

DEFAULT_MESSAGES = {
    status.HTTP_400_BAD_REQUEST: "Request payload is invalid.",
    status.HTTP_401_UNAUTHORIZED: "Authentication credentials were not provided or are invalid.",
    status.HTTP_403_FORBIDDEN: "You do not have permission to perform this action.",
    status.HTTP_404_NOT_FOUND: "The requested resource was not found.",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Method not allowed.",
    status.HTTP_409_CONFLICT: "The request conflicts with the current state of the resource.",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests. Please try again later.",
}


def _envelope(code: str, message: str, details=None) -> dict:
    """Build the canonical error envelope."""
    payload = {"code": code, "message": message}
    if details:
        payload["details"] = details
    return {"error": payload}


def api_exception_handler(exc, context):
    """DRF exception handler producing a consistent error envelope."""
    if isinstance(exc, (InvalidToken, TokenError)):
        return Response(
            _envelope(
                "token_error",
                "The supplied token is invalid, expired or has been revoked.",
            ),
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, AuthenticationFailed):
        return Response(
            _envelope("authentication_failed", str(exc.detail)),
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if isinstance(exc, Http404):
        exc = None
        return Response(
            _envelope("not_found", DEFAULT_MESSAGES[status.HTTP_404_NOT_FOUND]),
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, DjangoValidationError):
        return Response(
            _envelope(
                "validation_error",
                DEFAULT_MESSAGES[status.HTTP_400_BAD_REQUEST],
                details=getattr(exc, "message_dict", None) or {"detail": list(exc.messages)},
            ),
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, DRFValidationError):
        """Serializer validation errors use the canonical ``validation_error`` code."""
        details = exc.detail if isinstance(exc.detail, (dict, list)) else {"detail": exc.detail}
        return Response(
            _envelope(
                "validation_error",
                DEFAULT_MESSAGES[status.HTTP_400_BAD_REQUEST],
                details=details,
            ),
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, PermissionDenied):
        return Response(
            _envelope("permission_denied", DEFAULT_MESSAGES[status.HTTP_403_FORBIDDEN]),
            status=status.HTTP_403_FORBIDDEN,
        )

    if isinstance(exc, IntegrityError):
        logger.warning("Database integrity error: %s", exc)
        return Response(
            _envelope(
                "integrity_error",
                "The operation violates a database integrity constraint.",
            ),
            status=status.HTTP_409_CONFLICT,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        # Unhandled exception: log it server-side, return an opaque message.
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            _envelope(
                "server_error",
                "An unexpected server error occurred. Please try again later.",
            ),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = response.data
    code = getattr(exc, "default_code", "error")
    message = DEFAULT_MESSAGES.get(response.status_code, "Request failed.")

    details = None
    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        message = str(detail["detail"])
        detail = None
    elif isinstance(detail, (dict, list)):
        details = detail
    elif detail is not None:
        message = str(detail)

    response.data = _envelope(code, message, details=details)
    return response
