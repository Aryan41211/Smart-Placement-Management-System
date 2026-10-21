"""URL routing for the students app."""

from __future__ import annotations

from django.urls import path

from students import views

app_name = "students"

urlpatterns = [
    path("", views.StudentDirectoryView.as_view(), name="directory"),
    path("me/", views.MyProfileView.as_view(), name="my-profile"),
    path("departments/", views.DepartmentListView.as_view(), name="departments"),
    path("my/skills/", views.MySkillViewSet.as_view({"get": "list", "post": "create"}), name="my-skills"),
    path(
        "my/skills/<int:pk>/",
        views.MySkillViewSet.as_view(
            {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
        ),
        name="my-skill-detail",
    ),
    path("<int:student_id>/skills/", views.StudentSkillListView.as_view(), name="student-skills"),
    path("<int:pk>/", views.StudentManagementView.as_view(), name="student-detail"),
]
