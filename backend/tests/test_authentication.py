"""Authentication, registration and token handling tests."""

from __future__ import annotations

import pytest
from django.urls import reverse

from accounts.models import StudentProfile, User

from .conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_register_creates_student_account_and_returns_tokens(api_client, department):
    """A visitor may self-register as a student and receives a JWT pair."""
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "new.student@test.invalid",
            "full_name": "New Student",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "roll_number": "SPMS900",
            "department": department.id,
            "cgpa": "8.10",
            "graduation_year": 2026,
        },
        format="json",
    )
    assert response.status_code == 201, response.data
    payload = response.json()
    assert payload["access"] and payload["refresh"]
    assert payload["user"]["role"] == User.Role.STUDENT

    user = User.objects.get(email="new.student@test.invalid")
    assert user.check_password("StrongPass123!")
    assert StudentProfile.objects.filter(user=user, roll_number="SPMS900").exists()


def test_register_rejects_duplicate_email(api_client, department, student_user):
    """An e-mail address may only be registered once."""
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": student_user.email,
            "full_name": "Duplicate",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "roll_number": "SPMS901",
            "department": department.id,
            "cgpa": "7.00",
            "graduation_year": 2026,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "error" in response.json()


def test_register_rejects_mismatched_passwords(api_client, department):
    """The two passwords must match."""
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "mismatch@test.invalid",
            "full_name": "Mismatch",
            "password": "StrongPass123!",
            "password_confirm": "Different123!",
            "roll_number": "SPMS902",
            "department": department.id,
            "cgpa": "7.00",
            "graduation_year": 2026,
        },
        format="json",
    )
    assert response.status_code == 400


def test_register_rejects_cgpa_out_of_range(api_client, department):
    """CGPA is validated on the server, not only in the browser."""
    response = api_client.post(
        "/api/v1/auth/register/",
        {
            "email": "highcgpa@test.invalid",
            "full_name": "High CGPA",
            "password": "StrongPass123!",
            "password_confirm": "StrongPass123!",
            "roll_number": "SPMS903",
            "department": department.id,
            "cgpa": "12.50",
            "graduation_year": 2026,
        },
        format="json",
    )
    assert response.status_code == 400
    assert "cgpa" in response.json()["error"]["details"]


def test_login_returns_tokens_and_user(api_client, student_user):
    """A valid login returns an access token, a refresh token and the profile."""
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": student_user.email, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 200, response.data
    payload = response.json()
    assert payload["access"]
    assert payload["user"]["email"] == student_user.email


def test_login_rejects_wrong_password(api_client, student_user):
    """An incorrect password never yields a token."""
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": student_user.email, "password": "totally-wrong"},
        format="json",
    )
    assert response.status_code == 400
    assert "access" not in response.json()


def test_login_rejects_inactive_account(api_client, student_user):
    """A deactivated account cannot sign in."""
    student_user.is_active = False
    student_user.save(update_fields=["is_active"])
    response = api_client.post(
        "/api/v1/auth/login/",
        {"email": student_user.email, "password": PASSWORD},
        format="json",
    )
    assert response.status_code == 400


def test_me_requires_authentication(api_client):
    """The current-user endpoint is protected."""
    response = api_client.get("/api/v1/auth/me/")
    assert response.status_code == 401


def test_me_returns_profile_for_authenticated_user(student_client, student_profile):
    """The current-user endpoint returns the role specific profile."""
    response = student_client.get("/api/v1/auth/me/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["email"] == student_profile.user.email
    assert payload["student_profile"]["roll_number"] == "SPMS001"
    assert "student" in payload["permissions"]


def test_refresh_token_returns_new_access_token(api_client, student_user):
    """A refresh token can be exchanged for a new access token."""
    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": student_user.email, "password": PASSWORD},
        format="json",
    )
    refresh = login.json()["refresh"]
    response = api_client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
    assert response.status_code == 200
    assert response.json()["access"]


def test_logout_blacklists_refresh_token(api_client, student_user):
    """After logging out the refresh token can no longer be used."""
    login = api_client.post(
        "/api/v1/auth/login/",
        {"email": student_user.email, "password": PASSWORD},
        format="json",
    )
    refresh = login.json()["refresh"]
    api_client.force_authenticate(user=student_user)
    logout = api_client.post("/api/v1/auth/logout/", {"refresh": refresh}, format="json")
    assert logout.status_code == 200

    api_client.force_authenticate(user=None)
    response = api_client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
    assert response.status_code == 401


def test_change_password_requires_the_current_password(student_client, student_user):
    """Changing a password needs the existing one."""
    response = student_client.post(
        "/api/v1/auth/change-password/",
        {"current_password": "wrong-password", "new_password": "AnotherStrong123!"},
        format="json",
    )
    assert response.status_code == 400

    response = student_client.post(
        "/api/v1/auth/change-password/",
        {"current_password": PASSWORD, "new_password": "AnotherStrong123!"},
        format="json",
    )
    assert response.status_code == 200
    student_user.refresh_from_db()
    assert student_user.check_password("AnotherStrong123!")


def test_password_is_never_serialised(student_client):
    """The API never exposes password material."""
    response = student_client.get("/api/v1/auth/me/")
    body = response.content.decode()
    assert "password" not in body.lower()
