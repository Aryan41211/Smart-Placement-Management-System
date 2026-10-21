"""Reusable helpers for writing audit trail entries."""

from __future__ import annotations

import logging
from typing import Any

from core.models import AuditLog

logger = logging.getLogger(__name__)


def get_client_ip(request) -> str | None:
    """Best-effort extraction of the originating client IP address."""
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_audit(
    *,
    actor,
    action: str,
    entity_type: str,
    entity_id: Any,
    description: str = "",
    metadata: dict | None = None,
    request=None,
) -> AuditLog | None:
    """Persist an :class:`~core.models.AuditLog` row.

    Audit failures must never break the primary business transaction, so any
    unexpected error is logged and swallowed.
    """
    try:
        return AuditLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            actor_email=getattr(actor, "email", "") or "",
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            description=description,
            metadata=metadata or {},
            ip_address=get_client_ip(request),
        )
    except Exception:  # pragma: no cover - defensive, never break the request
        logger.exception("Unable to write audit log entry")
        return None
