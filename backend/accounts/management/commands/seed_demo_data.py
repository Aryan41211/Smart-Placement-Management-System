"""Seed the database with synthetic demonstration data.

The command is idempotent: running it twice does not create duplicate rows.
Every record is fictional and uses clearly fictional names.

Credentials
-----------
No password is ever hard-coded. Supply one explicitly::

    python manage.py seed_demo_data --password "YourLocalPassword"

If no password is supplied the command generates a random one and prints it
once, so the demo accounts stay usable without ever being published.

Optional administrator::

    python manage.py seed_demo_data --password "..." --admin-email officer@college.edu
"""

from __future__ import annotations

import random
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from accounts.models import RecruiterProfile, StudentProfile, User
from applications.models import Application, ApplicationStatusHistory
from applications.services import ALLOWED_TRANSITIONS
from companies.models import Company
from interviews.models import Interview, InterviewRound
from notifications.models import Notification
from placements.models import JobDrive, JobDriveSkill, Skill, StudentSkill
from placements.services import evaluate_eligibility
from students.models import Department

DEPARTMENTS = [
    ("CSE", "Computer Science and Engineering"),
    ("ECE", "Electronics and Communication Engineering"),
    ("ME", "Mechanical Engineering"),
    ("CE", "Civil Engineering"),
    ("IT", "Information Technology"),
]

SKILLS = [
    ("Python", "Programming"),
    ("Java", "Programming"),
    ("C++", "Programming"),
    ("SQL", "Data"),
    ("React", "Web Development"),
    ("Node.js", "Web Development"),
    ("Machine Learning", "Data"),
    ("Data Structures", "Computer Science"),
    ("Communication", "Soft Skills"),
    ("Problem Solving", "Soft Skills"),
    ("Excel", "Data"),
    ("Cloud Computing", "Infrastructure"),
]

COMPANIES = [
    ("Nexora Systems", Company.Industry.INFORMATION_TECHNOLOGY, "Bengaluru", "it"),
    ("Vertex Analytics", Company.Industry.PRODUCT, "Hyderabad", "product"),
    ("Bluewave Software", Company.Industry.IT_SERVICES, "Chennai", "it_services"),
    ("Orbit Technologies", Company.Industry.TELECOM, "Pune", "telecom"),
    ("Lumen Fintech", Company.Industry.FINANCE, "Mumbai", "finance"),
    ("Cobalt Consulting", Company.Industry.CONSULTING, "Delhi", "consulting"),
]

RECRUITERS = [
    ("recruiter.nexora@example.invalid", "Asha Rao", "Nexora Systems", "Talent Acquisition Lead"),
    ("recruiter.vertex@example.invalid", "Kabir Nair", "Vertex Analytics", "Hiring Manager"),
    ("recruiter.bluewave@example.invalid", "Meera Iyer", "Bluewave Software", "HR Business Partner"),
    ("recruiter.orbit@example.invalid", "Rohan Gupta", "Orbit Technologies", "Campus Recruiter"),
    ("recruiter.lumen@example.invalid", "Sara Khan", "Lumen Fintech", "Recruitment Specialist"),
    ("recruiter.cobalt@example.invalid", "Vikram Desai", "Cobalt Consulting", "Associate Partner"),
]

FIRST_NAMES = [
    "Aarav", "Diya", "Ishaan", "Kavya", "Neel", "Priya", "Rohan", "Sanya", "Vivaan", "Ananya",
    "Arjun", "Bhavya", "Chirag", "Devika", "Eshan", "Farhan", "Gauri", "Harsh", "Ira", "Jatin",
    "Kiran", "Lavya", "Manav", "Nisha",
]
LAST_NAMES = [
    "Sharma", "Verma", "Nair", "Patel", "Reddy", "Menon", "Kulkarni", "Bose", "Rao", "Joshi",
    "Chatterjee", "Malhotra", "Deshpande", "Sinha", "Gupta", "Mehta",
]

SKILL_SETS = [
    ["Python", "SQL", "Data Structures", "Problem Solving"],
    ["Java", "SQL", "Data Structures", "Communication"],
    ["Python", "Machine Learning", "Excel", "Problem Solving"],
    ["C++", "Data Structures", "Problem Solving", "Communication"],
    ["React", "Node.js", "SQL", "Communication"],
    ["Python", "Cloud Computing", "SQL", "Problem Solving"],
]


class Command(BaseCommand):
    """Populate the database with reproducible demonstration data."""

    help = "Seed the database with synthetic placement demo data (idempotent)."

    def add_arguments(self, parser):
        """Declare the command line arguments."""
        parser.add_argument(
            "--password",
            help="Password assigned to every generated demo account. "
            "If omitted a random password is generated and printed once.",
        )
        parser.add_argument(
            "--admin-email",
            help="Optional e-mail address for an administrator account to create.",
        )
        parser.add_argument("--reset", action="store_true", help="Delete existing demo rows first.")

    def handle(self, *args, **options):
        """Create (or refresh) the demonstration dataset."""
        password = options.get("password") or self._random_password()
        generated_password = not options.get("password")

        if options.get("reset"):
            self._reset()

        with transaction.atomic():
            departments = self._create_departments()
            skills = self._create_skills()
            companies = self._create_companies()
            recruiters = self._create_recruiters(companies, password)
            admin = self._create_admin(options.get("admin_email"), password)
            students = self._create_students(departments, skills, password)
            drives = self._create_drives(companies, departments, skills, admin, recruiters)
            self._create_applications(students, drives)
            self._create_interviews(drives)
            self._create_notifications(students, recruiters, admin)

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
        if generated_password:
            self.stdout.write(
                self.style.WARNING(
                    "Generated demo account password (shown once): "
                    f"{password}"
                )
            )
        self.stdout.write(f"Students: {StudentProfile.objects.count()}")
        self.stdout.write(f"Companies: {Company.objects.count()}")
        self.stdout.write(f"Job drives: {JobDrive.objects.count()}")
        self.stdout.write(f"Applications: {Application.objects.count()}")
        self.stdout.write(f"Interviews: {Interview.objects.count()}")
        self.stdout.write(f"Notifications: {Notification.objects.count()}")

    # -- helpers ------------------------------------------------------------
    def _random_password(self) -> str:
        """Generate a random password for the demo accounts."""
        import secrets
        import string

        alphabet = string.ascii_letters + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(14))

    def _reset(self):
        """Remove previously generated demo rows."""
        self.stdout.write("Removing existing demo data ...")
        ApplicationStatusHistory.objects.all().delete()
        Interview.objects.all().delete()
        InterviewRound.objects.all().delete()
        Application.objects.all().delete()
        Notification.objects.all().delete()
        JobDriveSkill.objects.all().delete()
        JobDrive.objects.all().delete()
        StudentSkill.objects.all().delete()
        StudentProfile.objects.all().delete()
        RecruiterProfile.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        Company.objects.all().delete()
        Skill.objects.all().delete()
        Department.objects.all().delete()

    def _create_departments(self) -> dict[str, Department]:
        """Create the academic departments."""
        result = {}
        for code, name in DEPARTMENTS:
            department, _ = Department.objects.get_or_create(
                code=code, defaults={"name": name, "annual_intake": 120}
            )
            result[code] = department
        return result

    def _create_skills(self) -> dict[str, Skill]:
        """Create the shared skill taxonomy."""
        result = {}
        for name, category in SKILLS:
            skill, _ = Skill.objects.get_or_create(name=name, defaults={"category": category})
            result[name] = skill
        return result

    def _create_companies(self) -> dict[str, Company]:
        """Create the participating companies."""
        result = {}
        for name, industry, location, slug_hint in COMPANIES:
            company, _ = Company.objects.get_or_create(
                name=name,
                defaults={
                    "industry": industry,
                    "location": location,
                    "website": f"https://www.{slug_hint}.example.invalid",
                    "description": f"{name} participates in the campus placement programme.",
                },
            )
            result[name] = company
        return result

    def _create_recruiters(self, companies: dict[str, Company], password: str) -> list[User]:
        """Create one recruiter account per company."""
        recruiters = []
        for email, full_name, company_name, designation in RECRUITERS:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": full_name,
                    "role": User.Role.RECRUITER,
                    "phone": "+91 90000 00000",
                },
            )
            if created:
                user.set_password(password)
                user.save(update_fields=["password"])
            RecruiterProfile.objects.get_or_create(
                user=user,
                defaults={
                    "company": companies[company_name],
                    "designation": designation,
                    "is_authorized": True,
                    "can_post_jobs": True,
                },
            )
            recruiters.append(user)
        return recruiters

    def _create_admin(self, email: str | None, password: str) -> User:
        """Create the optional administrator account."""
        if not email:
            email = "officer@example.invalid"
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "full_name": "Placement Officer",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": True,
            },
        )
        if created:
            user.set_password(password)
            user.save(update_fields=["password"])
        return user

    def _create_students(
        self, departments: dict[str, Department], skills: dict[str, Skill], password: str
    ) -> list[StudentProfile]:
        """Create 24 students spread over the departments."""
        rng = random.Random(20240501)
        students: list[StudentProfile] = []
        department_codes = list(departments.keys())

        for index in range(24):
            roll_number = f"SPMS{index + 1:03d}"
            email = f"student{index + 1:02d}@example.invalid"
            full_name = f"{FIRST_NAMES[index % len(FIRST_NAMES)]} {LAST_NAMES[index % len(LAST_NAMES)]}"
            department_code = department_codes[index % len(department_codes)]

            user, created = User.objects.get_or_create(
                email=email,
                defaults={"full_name": full_name, "role": User.Role.STUDENT},
            )
            if created:
                user.set_password(password)
                user.save(update_fields=["password"])

            cgpa = round(rng.uniform(5.4, 9.4), 2)
            backlogs = rng.choice([0, 0, 0, 0, 1, 2])
            graduation_year = 2026 + (index % 2)

            profile, _ = StudentProfile.objects.get_or_create(
                user=user,
                defaults={
                    "roll_number": roll_number,
                    "department": departments[department_code],
                    "cgpa": cgpa,
                    "active_backlogs": backlogs,
                    "graduation_year": graduation_year,
                    "current_semester": rng.choice([5, 6, 7, 8]),
                    "phone": f"+91 9{rng.randint(100000000, 999999999)}",
                    "bio": "Final year student interested in software engineering roles.",
                },
            )

            for skill_name in SKILL_SETS[index % len(SKILL_SETS)]:
                StudentSkill.objects.get_or_create(
                    student=profile,
                    skill=skills[skill_name],
                    defaults={
                        "proficiency_level": rng.choice([2, 3, 3, 4, 4, 5]),
                        "is_certified": rng.choice([True, False]),
                    },
                )
            students.append(profile)
        return students

    def _create_drives(
        self,
        companies: dict[str, Company],
        departments: dict[str, Department],
        skills: dict[str, Skill],
        admin: User,
        recruiters: list[User],
    ) -> list[JobDrive]:
        """Create job drives with a variety of eligibility requirements."""
        now = timezone.now()
        recruiter_for = {r.recruiter_profile.company.name: r for r in recruiters}

        specifications = [
            {
                "title": "Software Engineer 2026",
                "company": "Nexora Systems",
                "role": "Software Engineer",
                "package_min": Decimal("600000.00"),
                "package_max": Decimal("1200000.00"),
                "min_cgpa": Decimal("7.00"),
                "max_active_backlogs": 0,
                "departments": ["CSE", "IT"],
                "required": ["Python", "SQL", "Data Structures"],
                "deadline": now + timedelta(days=12),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Data Analyst 2026",
                "company": "Vertex Analytics",
                "role": "Data Analyst",
                "package_min": Decimal("450000.00"),
                "package_max": Decimal("800000.00"),
                "min_cgpa": Decimal("6.50"),
                "max_active_backlogs": 1,
                "departments": ["CSE", "IT", "ECE"],
                "required": ["SQL", "Excel"],
                "preferred": ["Python", "Machine Learning"],
                "deadline": now + timedelta(days=20),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Backend Engineer",
                "company": "Bluewave Software",
                "role": "Backend Engineer",
                "package_min": Decimal("500000.00"),
                "package_max": Decimal("900000.00"),
                "min_cgpa": Decimal("6.00"),
                "max_active_backlogs": None,
                "departments": [],
                "required": ["SQL", "Problem Solving"],
                "preferred": ["Java", "Python"],
                "deadline": now + timedelta(days=7),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Graduate Engineer Trainee",
                "company": "Orbit Technologies",
                "role": "Graduate Engineer Trainee",
                "package_min": Decimal("350000.00"),
                "package_max": Decimal("450000.00"),
                "min_cgpa": None,
                "max_active_backlogs": 2,
                "departments": ["ECE", "ME", "CE"],
                "required": ["Problem Solving"],
                "preferred": ["C++"],
                "deadline": now + timedelta(days=30),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.OFF_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Frontend Engineer Intern",
                "company": "Nexora Systems",
                "role": "Frontend Engineering Intern",
                "package_min": Decimal("250000.00"),
                "package_max": Decimal("300000.00"),
                "min_cgpa": Decimal("6.50"),
                "max_active_backlogs": 0,
                "departments": ["CSE", "IT"],
                "required": ["React", "Communication"],
                "deadline": now + timedelta(days=5),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.INTERNSHIP,
            },
            {
                "title": "Risk Analyst",
                "company": "Lumen Fintech",
                "role": "Risk Analyst",
                "package_min": Decimal("600000.00"),
                "package_max": Decimal("1000000.00"),
                "min_cgpa": Decimal("8.00"),
                "max_active_backlogs": 0,
                "departments": ["CSE", "ECE"],
                "required": ["SQL", "Excel", "Problem Solving"],
                "deadline": now + timedelta(days=15),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Consulting Analyst",
                "company": "Cobalt Consulting",
                "role": "Consulting Analyst",
                "package_min": Decimal("700000.00"),
                "package_max": Decimal("1100000.00"),
                "min_cgpa": Decimal("7.50"),
                "max_active_backlogs": 0,
                "departments": [],
                "required": ["Communication", "Problem Solving"],
                "preferred": ["Excel"],
                "deadline": now + timedelta(days=25),
                "status": JobDrive.Status.PUBLISHED,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Cloud Engineer (Draft)",
                "company": "Orbit Technologies",
                "role": "Cloud Engineer",
                "package_min": Decimal("800000.00"),
                "package_max": Decimal("1400000.00"),
                "min_cgpa": Decimal("7.00"),
                "max_active_backlogs": 0,
                "departments": ["CSE", "IT"],
                "required": ["Cloud Computing", "SQL"],
                "deadline": now + timedelta(days=40),
                "status": JobDrive.Status.DRAFT,
                "mode": JobDrive.DriveMode.ON_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
            {
                "title": "Closed Drive - Mechanical Design",
                "company": "Cobalt Consulting",
                "role": "Mechanical Design Associate",
                "package_min": Decimal("400000.00"),
                "package_max": Decimal("550000.00"),
                "min_cgpa": Decimal("6.00"),
                "max_active_backlogs": 1,
                "departments": ["ME"],
                "required": ["Problem Solving"],
                "deadline": now - timedelta(days=5),
                "status": JobDrive.Status.CLOSED,
                "mode": JobDrive.DriveMode.OFF_CAMPUS,
                "job_type": JobDrive.JobType.FULL_TIME,
            },
        ]

        drives: list[JobDrive] = []
        for spec in specifications:
            company = companies[spec["company"]]
            drive, created = JobDrive.objects.get_or_create(
                title=spec["title"],
                company=company,
                defaults={
                    "role_designation": spec["role"],
                    "description": (
                        f"{spec['role']} opportunity with {company.name}. "
                        "Selection follows the standard campus recruitment process."
                    ),
                    "job_type": spec["job_type"],
                    "drive_mode": spec["mode"],
                    "package_min": spec["package_min"],
                    "package_max": spec["package_max"],
                    "min_cgpa": spec["min_cgpa"],
                    "max_active_backlogs": spec["max_active_backlogs"],
                    "min_graduation_year": 2026,
                    "max_graduation_year": 2027,
                    "application_deadline": spec["deadline"],
                    "status": spec["status"],
                    "published_at": now if spec["status"] == JobDrive.Status.PUBLISHED else None,
                    "eligibility_notes": (
                        "Applicants must satisfy the published CGPA, backlog, department "
                        "and skill requirements."
                    ),
                    "created_by": recruiter_for.get(company.name, admin),
                },
            )
            if created:
                for code in spec["departments"]:
                    drive.allowed_departments.add(departments[code])
                for skill_name in spec["required"]:
                    JobDriveSkill.objects.get_or_create(
                        job_drive=drive,
                        skill=skills[skill_name],
                        defaults={
                            "requirement_level": JobDriveSkill.Requirement.REQUIRED,
                            "min_proficiency": 2,
                        },
                    )
                for skill_name in spec.get("preferred", []):
                    JobDriveSkill.objects.get_or_create(
                        job_drive=drive,
                        skill=skills[skill_name],
                        defaults={
                            "requirement_level": JobDriveSkill.Requirement.PREFERRED,
                            "min_proficiency": 1,
                        },
                    )
            drives.append(drive)
        return drives

    def _create_applications(self, students: list[StudentProfile], drives: list[JobDrive]):
        """Create applications in a spread of recruitment states."""
        open_drives = [
            drive for drive in drives if drive.status == JobDrive.Status.PUBLISHED
        ]
        status_cycle = [
            Application.Status.SELECTED,
            Application.Status.INTERVIEW,
            Application.Status.SHORTLISTED,
            Application.Status.UNDER_REVIEW,
            Application.Status.APPLIED,
            Application.Status.REJECTED,
            Application.Status.NOT_SELECTED,
            Application.Status.APPLIED,
            Application.Status.SHORTLISTED,
            Application.Status.APPLIED,
        ]
        cycle_index = 0

        for drive in open_drives:
            eligible = [
                student for student in students if evaluate_eligibility(student, drive).eligible
            ]
            # Take a deterministic slice so the demo dataset stays stable.
            for student in eligible[: 6 + (drive.pk % 4)]:
                target_status = status_cycle[cycle_index % len(status_cycle)]
                cycle_index += 1
                application, created = Application.objects.get_or_create(
                    student=student,
                    job_drive=drive,
                    defaults={
                        "status": Application.Status.APPLIED,
                        "status_changed_at": timezone.now(),
                    },
                )
                if not created:
                    continue
                self._apply_status_chain(application, target_status, student)

    def _apply_status_chain(
        self, application: Application, target_status: str, student: StudentProfile
    ):
        """Walk the application through the legal states up to ``target_status``."""
        chain: list[str] = []
        current = Application.Status.APPLIED
        guard = 0
        while current != target_status and guard < 6:
            guard += 1
            next_states = [
                status
                for status in ALLOWED_TRANSITIONS.get(current, set())
                if status != Application.Status.WITHDRAWN
            ]
            if target_status in next_states:
                chain.append(target_status)
                break
            if not next_states:
                break
            # Prefer moving further down the pipeline.
            next_states.sort(
                key=lambda status: [
                    Application.Status.APPLIED,
                    Application.Status.UNDER_REVIEW,
                    Application.Status.SHORTLISTED,
                    Application.Status.INTERVIEW,
                    Application.Status.SELECTED,
                ].index(status)
                if status
                in [
                    Application.Status.APPLIED,
                    Application.Status.UNDER_REVIEW,
                    Application.Status.SHORTLISTED,
                    Application.Status.INTERVIEW,
                    Application.Status.SELECTED,
                ]
                else 99
            )
            current = next_states[0]
            chain.append(current)

        previous = Application.Status.APPLIED
        for status in chain:
            application.status = status
            application.status_changed_at = timezone.now()
            if status == Application.Status.SHORTLISTED:
                application.shortlisted_at = timezone.now()
            if status == Application.Status.SELECTED:
                application.selected_at = timezone.now()
                application.offer_package = Decimal(str(application.job_drive.package_max))
            application.save()
            ApplicationStatusHistory.objects.get_or_create(
                application=application,
                from_status=previous,
                to_status=status,
                defaults={
                    "changed_by_role": "admin",
                    "reason": "Seeded demonstration transition",
                },
            )
            previous = status

    def _create_interviews(self, drives: list[JobDrive]):
        """Create interview rounds and a few scheduled interviews."""
        now = timezone.now()
        for drive in drives:
            if drive.status != JobDrive.Status.PUBLISHED:
                continue
            round_names = ["Technical Round 1", "Technical Round 2", "HR Interview"]
            rounds = []
            for index, name in enumerate(round_names, start=1):
                round_obj, _ = InterviewRound.objects.get_or_create(
                    job_drive=drive,
                    sequence=index,
                    defaults={
                        "name": name,
                        "description": f"{name} for {drive.role_designation}.",
                    },
                )
                rounds.append(round_obj)

            interview_candidates = Application.objects.filter(
                job_drive=drive,
                status__in=[
                    Application.Status.SHORTLISTED,
                    Application.Status.INTERVIEW,
                    Application.Status.SELECTED,
                ],
            )[:2]
            for offset, application in enumerate(interview_candidates):
                Interview.objects.get_or_create(
                    application=application,
                    round=rounds[0],
                    defaults={
                        "scheduled_at": now + timedelta(days=3 + offset, hours=10),
                        "duration_minutes": 60,
                        "mode": Interview.Mode.ONLINE,
                        "meeting_link": "https://meet.example.invalid/interview",
                        "status": (
                            Interview.Status.SCHEDULED
                            if application.status != Application.Status.SELECTED
                            else Interview.Status.COMPLETED
                        ),
                        "outcome": (
                            Interview.Outcome.PASSED
                            if application.status == Application.Status.SELECTED
                            else Interview.Outcome.PENDING
                        ),
                    },
                )

    def _create_notifications(self, students, recruiters, admin):
        """Create a small set of notifications for every role."""
        now = timezone.now()
        for index, student in enumerate(students[:6]):
            Notification.objects.get_or_create(
                recipient=student.user,
                title="Campus placement drive published",
                defaults={
                    "kind": Notification.Kind.DRIVE,
                    "message": (
                        "A new placement drive is open. Review the eligibility criteria "
                        "and apply before the deadline."
                    ),
                },
            )
        for recruiter in recruiters[:3]:
            Notification.objects.get_or_create(
                recipient=recruiter,
                title="Applicant pool updated",
                defaults={
                    "kind": Notification.Kind.SYSTEM,
                    "message": "New applicants are available for review in your drives.",
                },
            )
        if admin is not None:
            Notification.objects.get_or_create(
                recipient=admin,
                title="Placement cell weekly summary",
                defaults={
                    "kind": Notification.Kind.ANNOUNCEMENT,
                    "message": "The weekly placement summary is available in the reports section.",
                },
            )
