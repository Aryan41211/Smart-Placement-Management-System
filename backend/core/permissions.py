"""Role based permission classes.

Every protected API operation is guarded by one of these classes. Frontend
hiding of a button is a usability feature only - the backend is authoritative.
"""

from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Allow only placement-officer accounts."""

    message = "Only placement officers can perform this action."

    def has_permission(self, request, view) -> bool:
        """True when the authenticated user is an administrator."""
        user = request.user
        return bool(user and user.is_authenticated and user.is_admin)


class IsStudent(BasePermission):
    """Allow only student accounts."""

    message = "Only students can perform this action."

    def has_permission(self, request, view) -> bool:
        """True when the authenticated user is a student."""
        user = request.user
        return bool(user and user.is_authenticated and user.is_student)


class IsRecruiter(BasePermission):
    """Allow only recruiter accounts."""

    message = "Only recruiters can perform this action."

    def has_permission(self, request, view) -> bool:
        """True when the authenticated user is a recruiter."""
        user = request.user
        return bool(user and user.is_authenticated and user.is_recruiter)


class IsAdminOrReadOnly(BasePermission):
    """Everyone authenticated may read; only administrators may write."""

    def has_permission(self, request, view) -> bool:
        """Read access for any authenticated user, write access for admins."""
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(user.is_admin)


class IsOwnerOrAdmin(BasePermission):
    """Object level access: the record owner or an administrator.

    The view must expose ``owner_field`` (default ``"user"``) pointing at the
    attribute of the object that holds the owning account.
    """

    message = "You can only access your own records."

    def has_object_permission(self, request, view, obj) -> bool:
        """Compare the object's owner with the requesting account."""
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_admin:
            return True
        owner_field = getattr(view, "owner_field", "user")
        owner = getattr(obj, owner_field, None)
        if owner is None:
            return False
        if owner == user:
            return True
        # StudentProfile owns a User through a OneToOne relation.
        owner_user = getattr(owner, "user", None)
        return owner_user is not None and owner_user == user
