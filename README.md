# Smart Placement Management System

A database-backed campus placement portal: **Django 5.2 + Django REST Framework**
on **MySQL 8**, with a **React 19 + Vite + Tailwind CSS** front end.

Students browse drives, check server-computed eligibility and track applications.
Recruiters manage their own company's drives and applicants. The placement cell
runs the whole process — drives, approvals, the application pipeline, reports and
an audit trail.

- Three roles, authorised **on the server** for every request.
- Eligibility and the application state machine are evaluated **inside database
  transactions**; a duplicate application is impossible at the schema level.
- Every dashboard number is a **SQL aggregation** — there are no hard-coded
  metrics and no mocked screens.

---

## Table of contents

1. [Requirements](#1-requirements)
2. [Quick start (Windows / PowerShell)](#2-quick-start-windows--powershell)
3. [Create the MySQL database and user](#3-create-the-mysql-database-and-user)
4. [Configure `.env`](#4-configure-env)
5. [Backend setup](#5-backend-setup)
6. [Frontend setup](#6-frontend-setup)
7. [Demo accounts and seed data](#7-demo-accounts-and-seed-data)
8. [Run the application](#8-run-the-application)
9. [Verify the installation](#9-verify-the-installation)
10. [Roles and what each can do](#10-roles-and-what-each-can-do)
11. [Project layout](#11-project-layout)
12. [Documentation](#12-documentation)
13. [Troubleshooting](#13-troubleshooting)
14. [Security notes](#14-security-notes)

---

## 1. Requirements

| Tool | Version used | Notes |
|---|---|---|
| Python | 3.12.x | 3.11+ should work |
| MySQL Server | 8.0+ (8.4 fine) | must be InnoDB-capable (default) |
| Node.js | 20+ (22 used) | ships with npm |
| Git | any recent | optional for running |

---

## 2. Quick start (Windows / PowerShell)

For the impatient — full explanations follow.

```powershell
# from the repository root
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

Copy-Item .env.example .env
notepad .env                            # set DB_USER / DB_PASSWORD / DJANGO_SECRET_KEY

cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed_demo_data --password "LocalDemo@2026"
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://127.0.0.1:5173> and sign in as `officer@example.invalid` with
`LocalDemo@2026`.

---

## 3. Create the MySQL database and user

Connect as an administrator:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

Then run:

```sql
CREATE DATABASE IF NOT EXISTS placement_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'placement'@'localhost' IDENTIFIED BY 'your-strong-password';
CREATE USER IF NOT EXISTS 'placement'@'127.0.0.1' IDENTIFIED BY 'your-strong-password';

GRANT ALL PRIVILEGES ON placement_management.* TO 'placement'@'localhost';
GRANT ALL PRIVILEGES ON placement_management.* TO 'placement'@'127.0.0.1';

-- pytest-django creates a separate test database at run time.
GRANT ALL PRIVILEGES ON `test_placement_management`.* TO 'placement'@'localhost';
GRANT ALL PRIVILEGES ON `test_placement_management`.* TO 'placement'@'127.0.0.1';

FLUSH PRIVILEGES;
```

> Simplify the two grants with `GRANT ALL PRIVILEGES ON *.* TO 'placement'@'127.0.0.1';`
> only on a throw-away development machine.

The schema itself is **never** created by hand — `manage.py migrate` builds all
15 application tables, the junction tables, the constraints and the indexes.

---

## 4. Configure `.env`

```powershell
Copy-Item .env.example .env
```

Edit `.env` (it is git-ignored and must never be committed):

```ini
DJANGO_SECRET_KEY=<generate one, see below>
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost
DJANGO_CORS_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173

DB_NAME=placement_management
DB_USER=placement
DB_PASSWORD=your-strong-password
DB_HOST=127.0.0.1
DB_PORT=3306

JWT_ACCESS_TOKEN_LIFETIME_MINUTES=60
JWT_REFRESH_TOKEN_LIFETIME_DAYS=1
```

Generate a secret key:

```powershell
.\.venv\Scripts\python.exe -c "from django.core.management.utils import get_random_secret_key as k; print(k())"
```

---

## 5. Backend setup

```powershell
# 1. Virtual environment (once)
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # or use ..\.venv\Scripts\python.exe directly

# 2. Dependencies
pip install -r requirements.txt

# 3. Schema
cd backend
..\.venv\Scripts\python.exe manage.py migrate

# 4. Demonstration data
..\.venv\Scripts\python.exe manage.py seed_demo_data --password "LocalDemo@2026"

# 5. Run
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

> `mysqlclient` needs MySQL client libraries at install time. If `pip install`
> fails, install "MySQL Community Server" (which provides them) or use the
> pre-built wheel: `pip install --only-binary :all: mysqlclient`.

Useful management commands:

| Command | Purpose |
|---|---|
| `manage.py migrate` | create/patch the schema from migrations |
| `manage.py seed_demo_data --password "…" [--reset] [--admin-email …]` | idempotent demonstration data |
| `manage.py create_admin --email … --password …` | create/reset a placement-officer account |
| `manage.py create_recruiter --email … --password … --company …` | provision a recruiter |
| `manage.py showmigrations` | migration status |
| `manage.py test` | Django's runner (the project primarily uses pytest) |

---

## 6. Frontend setup

```powershell
cd frontend
npm install
npm run dev          # dev server on http://127.0.0.1:5173
npm run build        # production bundle into frontend/dist
npm run preview      # serve the production bundle on :4173
```

The dev server proxies `/api` to `http://127.0.0.1:8000`, so no CORS
configuration is needed during development. For a built bundle, set
`VITE_API_BASE_URL` in `.env` to the deployed API origin.

---

## 7. Demo accounts and seed data

`seed_demo_data` creates **synthetic, clearly fictional** records and is safe to
run repeatedly:

* 5 departments, 12 skills, 6 companies, 6 recruiters
* 24 students (`SPMS001`–`SPMS024`, `student01@example.invalid` … )
* 9 placement drives (7 published, 1 draft, 1 closed)
* 18 applications spread across the workflow, 5 interviews, 10 notifications

```powershell
..\.venv\Scripts\python.exe manage.py seed_demo_data --password "LocalDemo@2026" --admin-email officer@example.invalid
```

If `--password` is omitted the command generates a random one and prints it once.
**No credential is ever stored in this repository.**

| Role | Sign-in | Seeded account |
|---|---|---|
| Placement officer | officer portal | `officer@example.invalid` |
| Student | student portal | `student01@example.invalid` … `student24@example.invalid` |
| Recruiter | recruiter portal | `recruiter.nexora@example.invalid` (also `.vertex`, `.bluewave`, `.orbit`, `.lumen`, `.cobalt`) |

Students may also self-register from `/register`; admins and recruiters are
provisioned by the placement cell (`/admin/recruiters` or the management
commands).

---

## 8. Run the application

| Service | Command | URL |
|---|---|---|
| API | `cd backend; ..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000` | <http://127.0.0.1:8000/api/v1/> |
| API health | — | <http://127.0.0.1:8000/api/v1/health/> |
| Browsable API | same server, `DEBUG=True` | <http://127.0.0.1:8000/api/v1/drives/> |
| Web app | `cd frontend; npm run dev` | <http://127.0.0.1:5173> |
| Django admin | same server | <http://127.0.0.1:8000/admin/> (superuser only) |

---

## 9. Verify the installation

```powershell
# backend test suite (creates and drops test_placement_management)
cd backend
..\.venv\Scripts\python.exe -m pytest -q

# frontend production build
cd ..\frontend
npm run build

# schema sanity — should list 15 application tables plus framework tables
cd ..\backend
..\.venv\Scripts\python.exe -c "import django,os;os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings');django.setup();from django.db import connection;print('\n'.join(sorted(connection.introspection.table_names())))"
```

The last recorded results of these commands are in
[`docs/TESTING.md`](docs/TESTING.md).

---

## 10. Roles and what each can do

| Capability | Officer | Student | Recruiter |
|---|:--:|:--:|:--:|
| Manage students (directory, activate/deactivate) | ✅ | — | — |
| Manage companies | ✅ | read | read |
| Provision / authorise recruiters | ✅ | — | — |
| Create drives | ✅ | — | ✅ (own company, draft) |
| Publish / close / cancel drives | ✅ | — | — |
| Submit a drive for approval | ✅ | — | ✅ |
| Check eligibility | ✅ (any student) | ✅ (self) | ✅ (own applicants) |
| Apply to a drive | — | ✅ | — |
| Advance / reject an application | ✅ | — | ✅ (own company) |
| Withdraw an application | — | ✅ (self) | — |
| Schedule interviews, record outcomes | ✅ | — | ✅ (own company) |
| Reports, CSV exports, audit trail | ✅ | — | — |

The sidebar hides links a role cannot use, but that is cosmetic: the API rejects
the request with `403` regardless.

---

## 11. Project layout

```
.
├─ backend/
│  ├─ config/            settings, root URLconf, wsgi/asgi
│  ├─ core/              permissions, error envelope, pagination, audit, health
│  ├─ accounts/          custom User, student/recruiter profiles, JWT auth
│  ├─ students/          Department, directory, self-service profile & skills
│  ├─ companies/         Company directory, recruiter administration
│  ├─ placements/        Skill, JobDrive, eligibility engine
│  ├─ applications/      Application, status history, state machine
│  ├─ interviews/        InterviewRound, Interview
│  ├─ notifications/     Notification inbox and broadcast
│  ├─ reports/           dashboards, analytics, CSV exports
│  └─ tests/             pytest suite
├─ frontend/
│  └─ src/
│     ├─ api/            axios client + the entire URL contract
│     ├─ components/     design system (layout, ui, common, auth)
│     ├─ config/         navigation, application state-machine mirror
│     ├─ context/        AuthContext, ToastContext
│     ├─ hooks/          useApi, useDebounced
│     └─ pages/          auth, student, admin, recruiter, shared
├─ docs/                 ER diagram, schema, SQL, API, testing, viva, demo, report
├─ requirements.txt
├─ .env.example
└─ README.md
```

---

## 12. Documentation

| Document | Contents |
|---|---|
| [`docs/PROJECT_REPORT.md`](docs/PROJECT_REPORT.md) | abstract, objectives, modules, architecture, database design, implementation, testing, results, conclusion |
| [`docs/ER_DIAGRAM.md`](docs/ER_DIAGRAM.md) | Mermaid ER diagram plus every integrity rule |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | each table, keys, indexes and the 1NF→3NF argument |
| [`docs/SQL_QUERIES.md`](docs/SQL_QUERIES.md) | 30 MySQL queries: joins, aggregation, subqueries, window functions, transactions, `EXPLAIN` |
| [`docs/API_DOCUMENTATION.md`](docs/API_DOCUMENTATION.md) | every endpoint, payload, permission and error envelope |
| [`docs/TESTING.md`](docs/TESTING.md) | test strategy and the results of the last verified run |
| [`docs/VIVA_QUESTIONS.md`](docs/VIVA_QUESTIONS.md) | 36 DBMS viva questions with answers |
| [`docs/DEMO_GUIDE.md`](docs/DEMO_GUIDE.md) | a five-minute demonstration script |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | tiers, layering, the two engines, security model and trade-offs |

---

## 13. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `django.db.utils.OperationalError: (2002, "Can't connect …")` | MySQL is not running, or `DB_HOST`/`DB_PORT` are wrong. |
| `(1045, "Access denied for user …")` | `DB_USER`/`DB_PASSWORD` in `.env` do not match the grant. |
| `select_related` / migration errors on a stale schema | `manage.py migrate` — never edit tables by hand. |
| `pip install mysqlclient` fails | Install MySQL client libraries, or `pip install --only-binary :all: mysqlclient`. |
| Login succeeds but every page is empty | The API returned `401`; check the Django terminal and that `.env` `DJANGO_CORS_ALLOWED_ORIGINS` includes the Vite origin. |
| Port 8000 in use | `runserver 127.0.0.1:8001` and set `VITE_API_BASE_URL` accordingly. |
| PowerShell blocks `Activate.ps1` | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. |
| Tests cannot create the test database | Grant the user rights on `test_placement_management` (or `*.*`). |

---

## 14. Security notes

* **No secrets in the repository.** `.env` is git-ignored; `.env.example` ships
  placeholders only. Demo passwords are supplied locally on the command line.
* **Role enforcement is server-side**, including object-level scoping (a
  recruiter can only reach their own company's rows).
* **JWT** access tokens last 60 minutes; logout blacklists the refresh token.
* **Trade-off:** tokens are stored in browser `localStorage`, which is
  XSS-sensitive. React escapes output by default and a strict CSP is expected in
  production; an `HttpOnly`-cookie design would remove this exposure at the cost
  of CSRF handling. See `docs/ARCHITECTURE.md`.
* **CSV exports** quote cells beginning with `= + - @ tab CR LF` to prevent
  spreadsheet formula injection, and are restricted to placement officers.
* **`internal_notes`** on an application is removed server-side for student
  requests — it never reaches the browser.
* **Never commit** `.env`, database dumps, model weights or real student data.
  The seeder only ever produces fictional records.
