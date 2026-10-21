"""Authentication and account endpoints."""

from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.serializers import (
    ChangePasswordSerializer,
    LoginSerializer,
    MeSerializer,
    StudentRegistrationSerializer,
)
from core.audit import record_audit


def _token_payload(user) -> dict:
    """Build the JWT pair plus the authenticated user payload."""
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    access = refresh.access_token
    return {
        "access": str(access),
        "refresh": str(refresh),
        "user": MeSerializer(user).data,
    }


class RegisterView(GenericAPIView):
    """``POST /api/v1/auth/register/`` - student self-registration.

    Only students may self-register. Administrator and recruiter accounts are
    provisioned by the placement cell through a management command.
    """

    serializer_class = StudentRegistrationSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        """Create the student account and return the JWT pair."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()
        user = profile.user
        record_audit(
            actor=user,
            action="create",
            entity_type="User",
            entity_id=user.pk,
            description=f"Student registered with roll number {profile.roll_number}",
            request=request,
        )
        return Response(_token_payload(user), status=status.HTTP_201_CREATED)


class LoginView(GenericAPIView):
    """``POST /api/v1/auth/login/`` - exchange credentials for a JWT pair."""

    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        """Authenticate the user and issue access + refresh tokens."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        record_audit(
            actor=user,
            action="login",
            entity_type="User",
            entity_id=user.pk,
            description="User signed in",
            request=request,
        )
        return Response(_token_payload(user), status=status.HTTP_200_OK)


class RefreshTokenView(GenericAPIView):
    """``POST /api/v1/auth/refresh/`` - rotate an access token."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        """Return a fresh access token for a valid refresh token."""
        serializer = TokenRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """``POST /api/v1/auth/logout/`` - blacklist the supplied refresh token."""

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Blacklist the refresh token so it can no longer be used."""
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": {"code": "validation_error", "message": "A refresh token is required."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            # A token that cannot be blacklisted (expired / already used) is
            # still reported as a successful client-side sign out.
            pass
        record_audit(
            actor=request.user,
            action="logout",
            entity_type="User",
            entity_id=request.user.pk,
            description="User signed out",
            request=request,
        )
        return Response({"detail": "Signed out."}, status=status.HTTP_200_OK)


class MeView(APIView):
    """``GET /api/v1/auth/me/`` - the authenticated user's profile."""

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """Return the authenticated account with its role profile."""
        return Response(MeSerializer(request.user).data, status=status.HTTP_200_OK)


class ChangePasswordView(GenericAPIView):
    """``POST /api/v1/auth/change-password/`` - update the current password."""

    serializer_class = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        """Validate and store the new password."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        record_audit(
            actor=request.user,
            action="update",
            entity_type="User",
            entity_id=request.user.pk,
            description="Password changed",
            request=request,
        )
        return Response({"detail": "Password updated."}, status=status.HTTP_200_OK)


class ServerTimeView(APIView):
    """``GET /api/v1/auth/server-time/`` - authoritative server clock.

    The frontend uses this to compensate for client clock drift when it
    renders "deadline in X days" countdowns.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        """Return the current server timestamp."""
        return Response({"server_time": timezone.now().isoformat()}, status=status.HTTP_200_OK)
