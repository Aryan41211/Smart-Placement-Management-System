"""Create a recruiter account and associate it with a company.

The command prompts for the password interactively and can link the recruiter
to an existing company or create a new one.

Usage::

    python manage.py create_recruiter --email hr@acme.com --name "Asha Rao" --company "Acme Systems"
    python manage.py create_recruiter            # fully interactive
"""

from __future__ import annotations

import getpass

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from accounts.models import RecruiterProfile, User
from companies.models import Company


class Command(BaseCommand):
    """Provision a recruiter account bound to a single company."""

    help = "Create a recruiter account and associate it with a company."

    def add_arguments(self, parser):
        """Declare the optional command line arguments."""
        parser.add_argument("--email", help="Recruiter e-mail address (login id).")
        parser.add_argument("--name", help="Full name of the recruiter.")
        parser.add_argument("--company", help="Company name (created when it does not exist).")
        parser.add_argument("--designation", default="", help="Job designation of the recruiter.")
        parser.add_argument(
            "--authorize",
            action="store_true",
            help="Grant the recruiter rights to publish and manage drives.",
        )

    def handle(self, *args, **options):
        """Create the recruiter account."""
        email = options.get("email") or input("Recruiter e-mail: ").strip()
        if not email:
            raise CommandError("An e-mail address is required.")
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError("The e-mail address is not valid.")

        full_name = options.get("name") or input("Full name: ").strip()
        if not full_name:
            raise CommandError("A full name is required.")

        company_name = options.get("company") or input("Company name: ").strip()
        if not company_name:
            raise CommandError("A company name is required.")

        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"An account already exists for {email}.")

        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            raise CommandError("The passwords do not match.")
        if len(password) < 8:
            raise CommandError("The password must be at least 8 characters long.")

        company, _ = Company.objects.get_or_create(
            name=company_name,
            defaults={"location": "Bengaluru", "industry": Company.Industry.INFORMATION_TECHNOLOGY},
        )

        user = User.objects.create_user(
            email=email, password=password, full_name=full_name, role=User.Role.RECRUITER
        )
        RecruiterProfile.objects.create(
            user=user,
            company=company,
            designation=options.get("designation", ""),
            is_authorized=bool(options.get("authorize")),
            can_post_jobs=True,
        )

        self.stdout.write(self.style.SUCCESS(f"Recruiter '{email}' created for {company.name}."))
        if not options.get("authorize"):
            self.stdout.write(
                self.style.WARNING(
                    "The recruiter is NOT authorised yet. An administrator can authorise the "
                    "account from the admin panel or with the API."
                )
            )
