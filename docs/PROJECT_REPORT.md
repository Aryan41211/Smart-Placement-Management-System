# Project Report

**Title:** Smart Placement Management System
**Type:** Database Management Systems — term project
**Stack:** Python 3.12 · Django 5.2 · Django REST Framework · MySQL 8 · React 19 · Vite · Tailwind CSS

---

## 1. Abstract

Campus placement cells run on spreadsheets. A single file holds student CGPA
values, department names, company contacts, drive criteria and application status,
and the same fact is typed into several rows. The result is predictable:
eligibility is argued rather than computed, a student applies twice to the same
drive, "placed" means something different in every semester's sheet, and nobody
can answer *"which department is actually being placed?"* without an afternoon of
copy-paste.

Smart Placement Management System replaces that spreadsheet with a normalised
MySQL 8 database, a role-aware REST API and a web dashboard. It stores students,
departments, companies, recruiters, placement drives, skills, applications,
interview rounds and outcomes as first-class relations; it computes eligibility
and moves applications through a fixed state machine on the server; and it
answers the placement cell's questions with SQL aggregations rather than a
retyped summary.

The key design decisions are that **the database is the source of truth**
(Django migrations define the schema; 13 unique constraints, 19 foreign keys, a
`CHECK` constraint and 15 named indexes enforce the rules), that **the server is
the authority** (every rule is re-checked inside a transaction, so no crafted
request can bypass it) and that **every metric is an aggregation** (the
dashboards execute `COUNT`, `AVG`, `SUM` and `GROUP BY` in MySQL).

---

## 2. Objectives

1. Model the placement process as a **normalised relational schema** (3NF) with
   real keys, foreign keys, unique and check constraints and indexes.
2. Implement a **relational database in MySQL 8** (InnoDB, `utf8mb4`) whose schema
   is reproducible from Django migrations alone.
3. Enforce **three roles** — placement officer, student, recruiter — with
   server-side authorisation, not merely a hidden button.
4. Implement a **server-side eligibility engine** (CGPA, active backlogs,
   department, graduation year, required skills) that returns human-readable
   reasons, and re-evaluate it at submission time.
5. Implement an **application state machine** with an append-only history, so the
   progress of any application is auditable.
6. Prevent **duplicate applications** at the database level, and reject
   applications to closed or expired drives.
7. Provide **role-specific dashboards and management screens** backed entirely by
   live API data — no hard-coded metrics, no disconnected forms.
8. Produce **DBMS documentation** (ER diagram, schema reference, SQL catalogue,
   viva question bank, demo script) and an **automated test suite**.

### Non-goals

Deliberately out of scope: file uploads (resumes are stored as URLs), email/SMS
delivery (notifications are in-app), Docker/CI, and multi-tenancy. These keep the
project a demonstrable DBMS artefact rather than an infrastructure exercise.

---

## 3. Modules

| # | Module | Responsibility |
|---|---|---|
| 1 | Authentication & accounts | JWT login, student self-registration, `/auth/me/`, password change, logout with refresh-token blacklisting |
| 2 | Student management | Profile, skills, directory for the placement cell, account activation |
| 3 | Company & recruiter management | Company directory, recruiter provisioning and authorisation |
| 4 | Placement drives | Drive CRUD, eligibility criteria, publication workflow (draft → published → closed/cancelled), approval submission |
| 5 | Eligibility engine | `evaluate_eligibility()` used by the catalogue, the checker and submission |
| 6 | Applications | Submission, duplicate/pre-deadline guards, filters, notes, status history |
| 7 | Recruitment pipeline | The transition state machine, notifications, audit entries |
| 8 | Interviews | Rounds per drive, scheduling, outcome recording |
| 9 | Notifications | Per-user inbox, unread counters, admin broadcast |
| 10 | Reports & analytics | Role-aware dashboards, department/company/funnel/drive analytics, CSV exports |
| 11 | Audit trail | Append-only log of administrative and pipeline actions |
| 12 | Demo data | Idempotent `seed_demo_data` command |

### Screens (React)

26 routed screens: Login, Register, NotFound; student Dashboard, Profile, Skills,
Open Drives, Eligibility Checker, My Applications, My Interviews; officer
Dashboard, Student Directory, Student Detail, Company Directory, Recruiters,
Drive Management, Application Pipeline, Reports & Analytics, Audit Trail;
recruiter Dashboard, My Drives, Applicants, Interviews, Company Profile; and the
shared Notifications and Profile & Security pages.

---

## 4. System architecture

Three tiers, described in full in `docs/ARCHITECTURE.md`:

```
React SPA ──HTTPS/JSON──▶ Django REST Framework ──Django ORM──▶ MySQL 8 (InnoDB)
   │                            │                                  │
pages/components/           views/serializers/              15 tables + M2M
context/api                 services (rules)                FKs, UNIQUE, CHECK,
                            core (permissions,               indexes, transactions
                            errors, pagination, audit)
```

* The **client** owns presentation and routing only. `RouteGuards` decide which
  screens render; the server independently authorises every request.
* The **API** is layered: `views` (HTTP) → `serializers` (validation) →
  `services` (rules, transactions) → `models` (schema). Business logic never
  lives in a view.
* The **database** holds all constraints and performs all aggregation.

Cross-cutting concerns are centralised: `core/permissions.py` (role gates),
`core/exceptions.py` (one error envelope), `core/pagination.py` (one pagination
envelope), `core/audit.py` (audit writer), `reports/csv.py` (CSV sanitising).

### Authentication flow

1. `POST /auth/login/` returns `{access (60 min), refresh (1 day), user}`.
2. The client attaches `Authorization: Bearer <access>` to every request.
3. On `401`, the axios interceptor refreshes **once** — concurrent failures share
   a single refresh promise — and replays the original request.
4. If the refresh fails, tokens are cleared and `spms:session-expired` returns the
   user to the login screen.
5. `POST /auth/logout/` blacklists the refresh token so it cannot be reused.

---

## 5. Database design

The full schema is in `docs/DATABASE_SCHEMA.md`; the entity graph is in
`docs/ER_DIAGRAM.md`. Summary:

| # | Table | Rows of interest |
|---|---|---|
| 1 | `users` | custom user model, e-mail login, `role` column |
| 2 | `departments` | reference data, no spelling drift |
| 3 | `student_profiles` | 1-to-1 with `users`, academic record |
| 4 | `recruiter_profiles` | 1-to-1 with `users`, company authorisation |
| 5 | `companies` | recruiting organisations |
| 6 | `skills` | shared taxonomy |
| 7 | `student_skills` | junction + proficiency |
| 8 | `job_drives` | drives with eligibility criteria |
| 9 | `job_drive_skills` | junction + requirement level |
| 10 | `job_drives_allowed_departments` | M2M, empty = open to all |
| 11 | `applications` | unique per (student, drive) |
| 12 | `application_status_history` | append-only trail |
| 13 | `interview_rounds` | ordered stages per drive |
| 14 | `interviews` | scheduled sessions and outcomes |
| 15 | `notifications` | per-user inbox |
| 16 | `audit_logs` | administrative trail |

**Integrity objects:** 16 primary keys, 19 foreign keys, 13 unique constraints
(including `uniq_student_drive_application`), 1 check constraint
(`offer_package >= 0`), 15 named indexes.

**Normalisation:** 1NF (atomic values; skills and history moved to child tables),
2NF (surrogate keys; natural composite keys enforced with `UNIQUE`), 3NF
(transitive dependencies removed — only `department_id`/`company_id` are stored).
Four *snapshot* redundancies are documented and justified: the eligibility
snapshot, the pipeline milestone timestamps, `audit_logs.actor_email` and
`application_status_history.changed_by_role`.

**Referential actions:** `CASCADE` where a child is meaningless without its
parent (profile, application), `PROTECT` where history must not be lost
(company with drives, round with interviews), `SET NULL` for audit and authorship
references.

### The two engines

* **Eligibility** — `evaluate_eligibility(student, drive)` checks the deadline,
  CGPA, backlogs, department, graduation year and required skills, and returns
  `eligible`, machine `reasons` and student-facing `messages`. It is invoked by
  the catalogue, the standalone checker and `submit_application` (inside the
  transaction).
* **Pipeline** — `ALLOWED_TRANSITIONS` defines the state machine; students may
  only withdraw, recruiters may only act on their own company's applications,
  and every accepted transition writes history + audit + notification atomically.

---

## 6. Implementation highlights

| Area | What was built |
|---|---|
| Framework | Django 5.2 + DRF 3.16, 9 apps, `SimpleRouter` for ViewSets and explicit `path()` for APIViews |
| Auth | SimpleJWT with rotation; refresh-token blacklist app; `ScopedRateThrottle` (auth 10/min) |
| Validation | DRF serializers + model validators; cross-field rules (package range, graduation window, future deadline) |
| Concurrency | `transaction.atomic` + `select_for_update()` on the contended drive row |
| Aggregation | `reports/services.py` — dashboard, department, company, funnel, package, drive and recruiter analytics |
| Exports | Four admin CSV exports with formula-injection sanitising and `no-store` caching |
| Audit | `record_audit()` writes actor, action, entity, description, metadata and IP; failures never break the request |
| Error handling | One envelope for validation, auth, permission, not-found, integrity and unexpected errors |
| Frontend | React 19 + Vite 6 + Tailwind 3.4; 26 screens; a real design system (tokens, ~20 primitives, grouped sidebar, breadcrumbed top bar, toasts, modals, confirm dialogs, skeletons, empty states) |
| Charts | Recharts bar/pie charts driven by API aggregation payloads |
| Forms | React Hook Form + Zod on the auth screens; controlled forms elsewhere, with server error surfacing |

---

## 7. Testing

The suite is organised by concern and runs against the project's real MySQL
server (`test_placement_management` is created and destroyed by pytest-django;
the development database is never touched).

| Test module | Covers |
|---|---|
| `test_authentication.py` | registration, login, refresh, logout blacklisting, `/me/`, password change, throttling |
| `test_permissions.py` | anonymous rejection, role gates, object-level scoping, company write authorisation, account activation |
| `test_eligibility.py` | CGPA, backlog, department, graduation-year and skill rules; reason codes |
| `test_applications.py` | submission guard, duplicate prevention, deadline, state machine, history, notes visibility |
| `test_interviews.py` | round creation, cross-company rejection, scheduling rules, outcome recording |
| `test_notifications.py` | per-user isolation, read state, unread counters, broadcast |
| `test_reports.py` | dashboard metrics, role scoping, department/company statistics, exports |
| `test_seed.py` | demonstration dataset size, idempotency, history invariants, referential integrity |

The exact, current result of the last full run is recorded in
[`docs/TESTING.md`](TESTING.md). Verification was performed against the live
database, not simulated: migrations were applied, the seeder was executed, the
read-only SQL catalogue in `docs/SQL_QUERIES.md` was run through the `mysql`
client, the audit invariants (`0` orphan applications, `0` applications missing
their opening history row) were checked, and the production frontend bundle was
built.

---

## 8. Results

* **Schema** — 15 application tables (plus one M2M and framework tables) created
  by migration; all constraints and indexes present.
* **Demo dataset** — 24 students across 5 departments, 6 companies, 6 recruiters,
  9 drives (7 published, 1 draft, 1 closed), 18 applications spread across the
  pipeline, 5 interviews, 10 notifications; the seeder is idempotent.
* **Primary workflow** — an officer creates and publishes a drive; a student
  checks eligibility and applies; the recruiter sees the applicant and moves the
  application to *shortlisted*; the officer's dashboard, pipeline board and audit
  trail all reflect the change.
* **Reports** — department placement rates, company selection rates, the
  application funnel and package statistics, all computed by SQL and exportable
  to CSV.
* **Frontend** — the production bundle builds successfully and every screen
  consumes live API data.

---

## 9. Limitations

* Resumes and logos are stored as **URLs**; binary upload is out of scope.
* Notifications are **in-app only** — no email or SMS provider is wired in.
* Interviews have no calendar integration (no ICS export or external invites).
* Reports aggregate on demand; at a much larger scale a summary table or
  materialised view would be preferable.
* JWT storage in `localStorage` is XSS-sensitive; the trade-off and the
  alternative are documented in `docs/ARCHITECTURE.md`.

---

## 10. Future work

1. Email/SMS notifications with a queue (Celery + Redis).
2. Resume upload with `MEDIA_ROOT` storage and virus scanning.
3. Placement-policy analytics: year-over-year trends, offer acceptance tracking,
   multiple-offer handling.
4. Role for the training and placement faculty to export department-level reports.
5. Two-factor authentication for the placement-officer role.
6. Containerised deployment with a managed MySQL instance.

---

## 11. Conclusion

The project demonstrates that the placement process is fundamentally a
*relational* problem, and that most of its real-world errors — duplicate
applications, unevaluated eligibility, unprovable placement claims — are
database problems with database solutions: a unique constraint, a check
constraint, an index and a transaction.

The delivered system stores the campus placement process in a normalised MySQL 8
schema, enforces its rules in a transactional service layer that no client can
bypass, computes every metric with SQL aggregation, and presents it through 26
role-aware screens. It is reproducible from migrations, populated by an
idempotent seeder, covered by an automated test suite, and documented for the
viva, the demonstration and the annual report.

---

## Appendix A — Environment

| Component | Version |
|---|---|
| Python | 3.12.10 |
| Django | 5.2.4 |
| Django REST Framework | 3.16.0 |
| djangorestframework-simplejwt | 5.5.1 |
| django-filter | 25.1 |
| django-cors-headers | 4.7.0 |
| mysqlclient | 2.2.7 |
| python-dotenv | 1.1.1 |
| pytest / pytest-django | 8.3.5 / 4.11.1 |
| MySQL | 8.0.x (InnoDB, utf8mb4_0900_ai_ci) |
| React / Vite / Tailwind | 19 / 6 / 3.4 |

## Appendix B — Document map

| Document | Contents |
|---|---|
| `README.md` | Windows setup, run and verification commands |
| `docs/ARCHITECTURE.md` | tiers, layering, engines, security model, trade-offs |
| `docs/ER_DIAGRAM.md` | Mermaid ER diagram + integrity rules |
| `docs/DATABASE_SCHEMA.md` | every table, key, index and normalisation argument |
| `docs/SQL_QUERIES.md` | 30 MySQL queries: joins, aggregation, subqueries, windows, transactions, `EXPLAIN` |
| `docs/API_DOCUMENTATION.md` | every endpoint, payload, envelope and permission |
| `docs/TESTING.md` | test strategy and the recorded results of the last run |
| `docs/VIVA_QUESTIONS.md` | 36 DBMS questions with answers |
| `docs/DEMO_GUIDE.md` | five-minute demonstration script |
