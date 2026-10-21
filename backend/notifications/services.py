"""Notification helpers."""

from __future__ import annotations

import logging

from notifications.models import Notification

logger = logging.getLogger(__name__)


def notify(
    recipient,
    kind: str = Notification.Kind.SYSTEM,
    title: str = "",
    message: str = "",
    link: str = "",
) -> Notification | None:
    """Create a notification for ``recipient``.

    Notification failures must never abort the surrounding business
    transaction, so exceptions are logged and swallowed.
    """
    if recipient is None:
        return None
    try:
        return Notification.objects.create(
            recipient=recipient,
            kind=kind,
            title=title[:180],
            message=message,
            link=link[:300],
        )
    except Exception:  # pragma: no cover - defensive
        logger.exception("Unable to create notification")
        return None
