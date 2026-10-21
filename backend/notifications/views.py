"""Notification listing, read state and broadcast endpoints."""

from __future__ import annotations

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User
from core.permissions import IsAdmin
from notifications.models import Notification
from notifications.serializers import BroadcastSerializer, NotificationSerializer


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """A user may only ever read and update their own notifications."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["kind", "is_read"]
    ordering_fields = ["created_at", "read_at"]
    ordering = ["-created_at"]
    search_fields = ["title", "message"]

    def get_queryset(self):
        """Return only the authenticated user's notifications."""
        queryset = Notification.objects.filter(recipient=self.request.user)
        if self.request.query_params.get("unread") in {"true", "1"}:
            queryset = queryset.filter(is_read=False)
        return queryset

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        """``POST /api/v1/notifications/:id/read/`` - mark one as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=["is_read", "read_at"])
        return Response(NotificationSerializer(notification).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="read-all")
    def read_all(self, request, *args, **kwargs):
        """``POST /api/v1/notifications/read-all/`` - mark every notification read."""
        updated = Notification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"marked_read": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request, *args, **kwargs):
        """``GET /api/v1/notifications/unread-count/`` - badge counter."""
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread": count}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated, IsAdmin])
    def broadcast(self, request, *args, **kwargs):
        """``POST /api/v1/notifications/broadcast/`` - announce to the campus."""
        serializer = BroadcastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        audience = serializer.validated_data["audience"]
        recipients = User.objects.filter(is_active=True)
        if audience == "students":
            recipients = recipients.filter(role=User.Role.STUDENT)
        elif audience == "recruiters":
            recipients = recipients.filter(role=User.Role.RECRUITER)

        Notification.objects.bulk_create(
            [
                Notification(
                    recipient=recipient,
                    kind=serializer.validated_data["kind"],
                    title=serializer.validated_data["title"],
                    message=serializer.validated_data["message"],
                )
                for recipient in recipients
            ]
        )
        return Response(
            {"delivered": recipients.count()}, status=status.HTTP_201_CREATED
        )


class NotificationStatsView(viewsets.ViewSet):
    """Aggregated notification counters for the notification badge."""

    permission_classes = [IsAuthenticated]

    def list(self, request, *args, **kwargs):
        """Return unread/total counters grouped by kind."""
        rows = (
            Notification.objects.filter(recipient=request.user)
            .values("kind")
            .annotate(total=Count("id"))
            .order_by("kind")
        )
        unread = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response(
            {
                "unread": unread,
                "by_kind": [{"kind": row["kind"], "count": row["total"]} for row in rows],
            },
            status=status.HTTP_200_OK,
        )
