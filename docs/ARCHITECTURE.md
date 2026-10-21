# Architecture

Smart Placement Management System is a three-tier web application: a React SPA,
a Django REST Framework API and a MySQL 8 relational database. This document
explains how the tiers are laid out, why the boundaries sit where they do, and
which rules the code is expected to keep.

---

## 1. High-level view

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite + Tailwind)                                │
│                                                                      │
│   src/pages/*        role-scoped screens                             │
│   src/components/*   design-system primitives + layout shell         │
│   src/context/*      AuthContext (JWT) · ToastContext                │
│   src/api/client.js  axios instance + single-flight token refresh    │
│   src/api/endpoints.js  the entire URL contract in one module        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  HTTPS / JSON  (Bearer <access token>)
                                │  dev: Vite proxy /api -> 127.0.0.1:8000
┌───────────────────────────────▼──────────────────────────────────────┐
│  Django REST Framework API  (/api/v1/…)                              │
│                                                                      │
│   config/urls.py        root routing, one path per app               │
│   <app>/views.py        ViewSets + APIViews                          │
│   <app>/serializers.py  request validation + response shaping        │
│   <app>/services.py     business rules (eligibility, state machine)  │
│   core/permissions.py   role gates used by every protected view      │
│   core/exceptions.py    one error envelope for every failure         │
│   core/audit.py         append-only audit trail writer               │
└───────────────────────────────┬──────────────────────────────────────┘
                                │  Django ORM (parameterised SQL)
┌───────────────────────────────▼──────────────────────────────────────┐
│  MySQL 8  ·  InnoDB  ·  utf8mb4_0900_ai_ci                           │
│  15 application tables + 1 M2M table + framework tables              │
│  FKs · UNIQUE · CHECK · covering indexes · transactions              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend layering

Each Django app owns one bounded area and exposes it through a thin view layer.

| Layer | Responsibility | Must **not** do |
|---|---|---|
| `views.py` | HTTP shape, permissions, pagination | contain business rules |
| `serializers.py` | validation, field shaping | talk to MySQL directly |
| `services.py` | eligibility, state machine, aggregation | know about HTTP |
| `models.py` | schema, constraints, small derived properties | orchestrate workflows |
| `core/` | cross-cutting permissions, errors, pagination, audit | hold domain data |

Rules that keep the boundaries honest:

1. **The client is never the authority.** `core/permissions.py` gates every
   protected endpoint. Hiding a button in React changes nothing on the server.
2. **Every lifecycle change goes through a service.** `submit_application` and
   `transition_application` re-read the row with `select_for_update()` inside a
   `transaction.atomic()` block, so a race between two requests cannot produce
   an illegal state.
3. **Aggregation happens in the database.** `reports/services.py` uses
   `Count`, `Avg`, `Sum` and `GROUP BY`. No screen receives raw rows in order to
   add them up in JavaScript.
4. **Failures have one shape.** `core/exceptions.py` converts DRF and JWT errors
   into `{"error": {"code", "message", "details"}}`, so the client has exactly
   one branch to handle.

### Application map

| App | Models | Endpoint namespace |
|---|---|---|
| `accounts` | `User`, `StudentProfile`, `RecruiterProfile` | `/api/v1/auth/` |
| `students` | `Department` | `/api/v1/students/`, `/api/v1/skills/` |
| `companies` | `Company` | `/api/v1/companies/`, `/api/v1/recruiters/` |
| `placements` | `Skill`, `StudentSkill`, `JobDrive`, `JobDriveSkill` | `/api/v1/drives/` |
| `applications` | `Application`, `ApplicationStatusHistory` | `/api/v1/applications/` |
| `interviews` | `InterviewRound`, `Interview` | `/api/v1/rounds/`, `/api/v1/interviews/` |
| `notifications` | `Notification` | `/api/v1/notifications/` |
| `reports` | *(aggregation only)* | `/api/v1/dashboard/`, `/api/v1/analytics/`, `/api/v1/reports/` |
| `core` | `AuditLog` | `/api/v1/audit-logs/` |

---

## 3. The two backend "engines"

### 3.1 Eligibility engine — `placements/services.py`

`evaluate_eligibility(student, drive)` returns an immutable `EligibilityResult`
with `eligible`, `reasons` (machine codes) and `messages` (sentences shown to the
student). It checks, in order:

1. drive `status` is `published` and the deadline is in the future;
2. `min_cgpa`;
3. `max_active_backlogs`;
4. allowed departments (empty set = open to all);
5. graduation-year window;
6. every `required` `JobDriveSkill`.

`preferred` skills are reported as information but never block a student. The
same function is called by the drive catalogue, the standalone checker and —
critically — by `submit_application` **inside** the transaction, so a drive that
closes between the page render and the click is still rejected.

### 3.2 Recruitment state machine — `applications/services.py`

```
applied ─┬─> under_review ─┬─> shortlisted ─┬─> interview ─┬─> selected (terminal)
         │                 │                │              ├─> not_selected (terminal)
         │                 │                │              └─> rejected (terminal)
         └─────────────────┴────────────────┴────────────────> withdrawn (terminal)
```

* `ALLOWED_TRANSITIONS` is the single source of truth.
* `STUDENT_ONLY_TRANSITIONS = {withdrawn}` — a student may only withdraw.
* `_assert_actor_allowed` additionally checks *ownership*: a recruiter may only
  move applications belonging to their own company's drives; an officer may
  move anything.
* Every accepted transition writes an `application_status_history` row and an
  `audit_logs` row **in the same transaction** as the status update.

---

## 4. Frontend architecture

### 4.1 API client — `src/api/client.js`

* Attaches `Authorization: Bearer <access>` to every request.
* On a `401` it refreshes **once** and replays the request. Concurrent 401s share
  a single refresh promise (`refreshPromise`) so the browser never fires a burst
  of refresh calls.
* If the refresh fails it clears the tokens and dispatches
  `spms:session-expired`; `AuthContext` listens for that event and returns the
  user to the login screen.
* Normalises every backend failure into an `ApiError` carrying `code`, `message`,
  `details` and `status`.

### 4.2 Auth context — `src/context/AuthContext.jsx`

Holds the decoded `/auth/me/` payload. Exposes `role`, `isAdmin`, `isStudent`,
`isRecruiter`. `RouteGuards.jsx` uses those flags to *render* the right screens;
the server re-checks every request anyway. This split is deliberate and is
called out in the README's security notes.

### 4.3 Design system — `src/components/`

| Group | Files |
|---|---|
| Layout | `AppShell`, `Sidebar`, `Topbar` |
| Auth | `AuthLayout`, `RouteGuards` |
| UI primitives | `Button`, `Card` (+`CardHeader/Body/Footer`), `Badge`, `Table`, `Field` (`Input`/`Select`/`Textarea`/`Checkbox`), `Modal`, `Pagination`, `StatCard`, `EmptyState`, `Loading`/`TableSkeleton` |
| Page furniture | `PageHeader`, `SearchInput`, `StatusBadge`, `ErrorState`, `ConfirmDialog`, `StatusTimeline`, `ApplicationStatusDialog` |

Design tokens live in `tailwind.config.js` (palette, shadow scale, animation
keyframes) and `src/index.css` (`--app-bg`, `--app-surface`, `--app-border`,
`.card`, `.input-base`, `.table-head`, `.table-row`, `.eyebrow`). Every screen
composes these primitives; no page defines its own card or button.

### 4.4 Routing

`src/App.jsx` declares all 26 screens. Each authenticated screen is wrapped in
`<RequireAuth><AppShell/></RequireAuth>` and, where it matters,
`<RequireRole roles={[...]}>`. An unknown URL falls through to `NotFoundPage`.

---

## 5. Security model

| Concern | Decision |
|---|---|
| Authentication | JWT (SimpleJWT). Access 60 min, refresh 1 day, rotation on refresh. |
| Logout | The refresh token is blacklisted server-side, so it cannot be replayed. |
| Authorisation | DRF permission classes per view/action + object-level checks in services. |
| Password policy | Django validators: ≥ 8 chars, not common, not numeric. |
| Transport (prod) | `SECURE_SSL_REDIRECT`, secure cookies, HSTS-friendly defaults when `DEBUG=False`. |
| CSV exports | Formula-prefix cells (`= + - @ tab CR LF`) are quoted so a spreadsheet cannot execute them. |
| Notes visibility | `internal_notes` is stripped server-side for student requests. |
| Rate limiting | `ScopedRateThrottle` on the auth routes (10/min) and password resets (5/min). |
| Secrets | `.env` only. `.env.example` ships placeholders. `.env` is git-ignored. |

### Known trade-off: tokens in `localStorage`

The SPA stores the JWT pair in `localStorage`. This is simple, survives a
refresh and keeps the API stateless, but it is readable by any script running on
the origin, so it is XSS-sensitive. The mitigation chosen here is strict output
escaping (React does this by default) plus a strict CSP in production. Moving to
`HttpOnly` cookies with CSRF tokens would remove the XSS exposure at the cost of
a stateful session and a CSRF defence; that trade-off is documented rather than
hidden.

---

## 6. Request lifecycle (one worked example)

`POST /api/v1/applications/` from a signed-in student:

1. `client.js` attaches the access token.
2. `JWTAuthentication` validates it; on `401` the client refreshes and replays.
3. `ApplicationViewSet.create` resolves the caller's `StudentProfile`.
4. `ApplicationCreateSerializer` validates `job_drive` (published, open).
5. `submit_application` opens a transaction, `select_for_update()` on the drive,
   re-checks the deadline, checks for a duplicate, runs `evaluate_eligibility`,
   then inserts `applications` + `application_status_history` and calls `notify`.
6. The row is serialised. `internal_notes` is absent for a student caller.
7. The client receives `201`, shows a toast and reloads the list.

A failure at any of steps 3–5 raises a DRF exception; `core/exceptions.py` turns
it into the standard error envelope with a stable `code`.

---

## 7. Why these choices

* **MySQL (not SQLite)** — the project is a DBMS course artefact. The schema uses
  `InnoDB`, foreign keys, `CHECK` constraints, composite indexes and
  `SELECT … FOR UPDATE`, all of which are the point of the exercise.
* **Migrations as the single source of truth** — the schema is never hand-edited.
  `makemigrations`/`migrate` reproduce it exactly.
* **Service functions instead of fat serializers** — eligibility and the state
  machine are called from more than one entry point (catalogue, checker,
  submission, admin bulk actions), so they live in one testable place.
* **Aggregations in SQL** — it keeps the client honest about "no mocked metrics"
  and demonstrates `GROUP BY`/`JOIN`/subquery skills.
* **No Docker / no queue / no cache** — deliberately out of scope for a
  time-boxed college project; the demo must run with `runserver` and `vite`.
