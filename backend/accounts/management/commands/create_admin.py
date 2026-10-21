"""Create the first placement-officer (administrator) account.

The command prompts for the password interactively so that no credential is
ever written into the shell history, a script or the repository.

Usage::

    python manage.py create_admin --email officer@college.edu --name "Placement Officer"
    python manage.py create_admin            # fully interactive
"""

from __future__ import annotations

import getpass

from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

from accounts.models import User


class Command(BaseCommand):
    """Provision an administrator account with an interactive password prompt."""

    help = "Create an administrator (placement officer) account."

    def add_arguments(self, parser):
        """Declare the optional command line arguments."""
        parser.add_argument("--email", help="Administrator e-mail address (login id).")
        parser.add_argument("--name", help="Full name of the placement officer.")
        parser.add_argument(
            "--no-input",
            action="store_true",
            help="Do not prompt (the password is then read from the DEMO_ADMIN_PASSWORD env var).",
        )

    def handle(self, *args, **options):
        """Create the administrator account."""
        email = options.get("email") or input("Administrator e-mail: ").strip()
        if not email:
            raise CommandError("An e-mail address is required.")
        try:
            validate_email(email)
        except ValidationError:
            raise CommandError("The e-mail address is not valid.")

        full_name = options.get("name") or input("Full name: ").strip()
        if not full_name:
            raise CommandError("A full name is required.")

        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"An account already exists for {email}.")

        if options.get("no_input"):
            import os

            password = os.environ.get("DEMO_ADMIN_PASSWORD", "")
            if not password:
                raise CommandError(
                    "Set the DEMO_ADMIN_PASSWORD environment variable or run without --no-input."
                )
            confirm = password
        else:
            password = getpass.getpass("Password: ")
            confirm = getpass.getpass("Confirm password: ")
            if password != confirm:
                raise CommandError("The passwords do not match.")
            if len(password) < 8:
                raise CommandError("The password must be at least 8 characters long.")

        user = User.objects.create_superuser(email=email, password=password, full_name=full_name)
        user.role = User.Role.ADMIN
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=["role", "is_staff", "is_superuser"])

        self.stdout.write(self.style.SUCCESS(f"Administrator '{email}' created successfully."))
        self.stdout.write("Sign in at /api/v1/auth/login/ using this e-mail address.")
