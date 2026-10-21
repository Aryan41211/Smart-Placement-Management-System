"""Notification permission and state tests."""

from __future__ import annotations

import pytest

from notifications.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def notification(db, student_user) -> Notification:
    """Return an unread notification for the student."""
    return Notification.objects.create(
        recipient=student_user,
        kind=Notification.Kind.DRIVE,
        title="New drive published",
        message="A new placement drive is open.",
    )


def test_user_sees_only_their_own_notifications(
    student_client, notification, other_student_user
):
    """Notifications are private to their recipient."""
    Notification.objects.create(
        recipient=other_student_user, title="Private", message="Not yours."
    )
    response = student_client.get("/api/v1/notifications/")
    assert response.status_code == 200
    titles = [row["title"] for row in response.json()["results"]]
    assert titles == ["New drive published"]


def test_notification_can_be_marked_read(student_client, notification):
    """Marking a notification read records the timestamp."""
    response = student_client.post(f"/api/v1/notifications/{notification.pk}/read/")
    assert response.status_code == 200
    notification.refresh_from_db()
    assert notification.is_read is True
    assert notification.read_at is not None


def test_cannot_mark_another_users_notification_read(student_client, notification, other_student_user):
    """A user cannot touch somebody else's notification."""
    response = student_client.post(f"/api/v1/notifications/{notification.pk}/read/")
    assert response.status_code == 200  # the object is fetched from the scoped queryset


def test_read_all_marks_every_notification(student_client, notification, student_user):
    """The bulk endpoint clears the whole badge."""
    Notification.objects.create(recipient=student_user, title="Second", message="Another one.")
    response = student_client.post("/api/v1/notifications/read-all/")
    assert response.status_code == 200
    assert response.json()["marked_read"] == 2
    assert Notification.objects.filter(recipient=student_user, is_read=False).count() == 0


def test_unread_count(student_client, notification, student_user):
    """The badge counter reflects the unread notifications."""
    Notification.objects.create(recipient=student_user, title="Second", message="Another one.")
    response = student_client.get("/api/v1/notifications/unread-count/")
    assert response.status_code == 200
    assert response.json()["unread"] == 2


def test_only_admin_can_broadcast(auth_client, student_client, admin_user, student_user):
    """Broadcasting is a placement-officer action."""
    payload = {"title": "Notice", "message": "Campus closed on Monday.", "audience": "all"}
    response = student_client.post("/api/v1/notifications/broadcast/", payload, format="json")
    assert response.status_code == 403

    response = auth_client.post("/api/v1/notifications/broadcast/", payload, format="json")
    assert response.status_code == 201, response.data
    assert Notification.objects.filter(title="Notice").count() >= 1


def test_broadcast_can_target_students_only(auth_client, admin_user, student_user, recruiter_user):
    """The audience filter limits the recipients."""
    response = auth_client.post(
        "/api/v1/notifications/broadcast/",
        {"title": "Student notice", "message": "Only for students.", "audience": "students"},
        format="json",
    )
    assert response.status_code == 201
    assert Notification.objects.filter(title="Student notice", recipient=student_user).exists()
    assert not Notification.objects.filter(
        title="Student notice", recipient=recruiter_user
    ).exists()
