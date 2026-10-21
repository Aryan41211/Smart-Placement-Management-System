"""Student directory, self-service profile and skill endpoints."""

from __future__ import annotations

from django.db.models import Count, Exists, OuterRef, Q
from django.db.models import QuerySet
from rest_framework import status
from rest_framework.generics import ListAPIView, ListCreateAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from accounts.models import StudentProfile
from applications.models import Application
from core.permissions import IsAdmin, IsOwnerOrAdmin, IsStudent
from students.models import Department
from students.serializers import (
    MyProfileSerializer,
    SkillSerializer,
    StudentDirectorySerializer,
    StudentSkillSerializer,
)


class DepartmentListView(ListAPIView):
    """``GET /api/v1/students/departments/`` - academic departments."""

    queryset = Department.objects.filter(is_active=True)
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        """Allow a search term for departments."""
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return queryset

    def list(self, request, *args, **kwargs):
        """Return the department list without pagination."""
        queryset = self.filter_queryset(self.get_queryset())
        return Response(queryset, status=status.HTTP_200_OK)


class StudentDirectoryView(ListAPIView):
    """``GET /api/v1/students/`` - administrative student directory.

    Only placement officers may list students. Supports server-side search,
    filtering by department / CGPA / graduation year / placement status and
    ordering.
    """

    serializer_class = StudentDirectorySerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ["department", "graduation_year", "active_backlogs"]
    ordering_fields = ["roll_number", "cgpa", "graduation_year", "created_at"]
    ordering = ["roll_number"]
    search_fields = ["roll_number", "user__full_name", "user__email"]

    def get_queryset(self) -> QuerySet:
        """Build the filtered, annotated directory queryset."""
        queryset = StudentProfile.objects.select_related("user", "department").annotate(
            application_count=Count("applications", distinct=True),
            placed=Exists(
                Application.objects.filter(
                    student=OuterRef("pk"), status=Application.Status.SELECTED
                )
            ),
        )

        params = self.request.query_params
        min_cgpa = params.get("min_cgpa")
        max_cgpa = params.get("max_cgpa")
        if min_cgpa:
            queryset = queryset.filter(cgpa__gte=min_cgpa)
        if max_cgpa:
            queryset = queryset.filter(cgpa__lte=max_cgpa)
        placed = params.get("placed")
        if placed in {"true", "1"}:
            queryset = queryset.filter(placed=True)
        elif placed in {"false", "0"}:
            queryset = queryset.filter(placed=False)
        skill = params.get("skill")
        if skill:
            queryset = queryset.filter(skills__skill__name__iexact=skill)
        return queryset.distinct()


class MyProfileView(APIView):
    """``GET|PATCH /api/v1/students/me/`` - the student's own profile."""

    permission_classes = [IsAuthenticated, IsStudent]

    def get(self, request, *args, **kwargs):
        """Return the authenticated student's profile."""
        profile = StudentProfile.objects.select_related("user", "department").get(user=request.user)
        return Response(MyProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        """Update the authenticated student's profile."""
        profile = StudentProfile.objects.select_related("user", "department").get(user=request.user)
        serializer = MyProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


class MySkillViewSet(ModelViewSet):
    """Manage the skills listed on the authenticated student's profile."""

    serializer_class = StudentSkillSerializer
    permission_classes = [IsAuthenticated, IsStudent]
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        """Return only the authenticated student's skill links."""
        return (
            StudentSkill.objects.filter(student__user=self.request.user)
            .select_related("skill")
            .order_by("-proficiency_level", "skill__name")
        )

    def get_serializer_context(self):
        """Attach the owning student to the serializer context."""
        context = super().get_serializer_context()
        context["student"] = StudentProfile.objects.filter(user=self.request.user).first()
        return context

    def perform_create(self, serializer):
        """Attach the skill link to the authenticated student."""
        serializer.save(student=self.get_serializer_context()["student"])


class SkillListCreateView(ListCreateAPIView):
    """``GET|POST /api/v1/skills/`` - the shared skill taxonomy.

    Any authenticated user may read the taxonomy; only placement officers may
    add a new skill.
    """

    serializer_class = SkillSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["category"]
    search_fields = ["name", "category"]
    ordering_fields = ["name", "category"]
    ordering = ["name"]

    def get_permissions(self):
        """Require administrator rights for write operations."""
        if self.request.method == "POST":
            return [IsAuthenticated(), IsAdmin()]
        return super().get_permissions()

    def get_queryset(self) -> QuerySet:
        """Return all skills."""
        return Skill.objects.all()


class StudentSkillListView(ListAPIView):
    """``GET /api/v1/students/:id/skills/`` - skills of one student."""

    serializer_class = StudentSkillSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    pagination_class = None

    def get_queryset(self) -> QuerySet:
        """Return the skill links of the requested student."""
        return (
            StudentSkill.objects.filter(student_id=self.kwargs["student_id"])
            .select_related("skill")
            .order_by("-proficiency_level", "skill__name")
        )
