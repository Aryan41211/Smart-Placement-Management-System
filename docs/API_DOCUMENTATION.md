# API Documentation

Base URL (development): **`http://127.0.0.1:8000/api/v1/`**
Content type: **`application/json`**
Authentication: **JWT bearer** — send `Authorization: Bearer <access_token>`.

A browsable API is available in a browser when `DEBUG=True` (DRF's
`BrowsableAPIRenderer`); the same URLs return JSON to the React client.

---

## 1. Conventions

### 1.1 Pagination

List endpoints return this envelope (page size defaults to 20, override with
`?page_size=`, maximum 100):

```json
{
  "count": 137,
  "page": 1,
  "pages": 7,
  "page_size": 20,
  "next": "http://127.0.0.1:8000/api/v1/students/?page=2",
  "previous": null,
  "results": []
}
```

Two convenience endpoints are intentionally **not** paginated and return a bare
array: `GET /my-applications/` and `GET /my-interviews/`.

### 1.2 Errors

Every failure — validation, permission, authentication, conflict — uses one
envelope:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request payload is invalid.",
    "details": { "cgpa": ["Ensure this value is less than or equal to 10.00."] }
  }
}
```

`details` is present only when the server can attribute the failure to fields.
Stable `code` values: `validation_error`, `authentication_failed`,
`token_error`, `permission_denied`, `not_found`, `integrity_error`,
`server_error`.

### 1.3 Roles

| Role | Meaning |
|---|---|
| `admin` | placement officer — full read, drives, approvals, reports, audit |
| `student` | view drives, check eligibility, apply, track, withdraw |
| `recruiter` | manage own company's drives and applicants, schedule interviews |

Permissions are enforced **on the server** for every request, including object
level checks (a recruiter only reaches their own company's rows).

---

## 2. Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health/` | none | API + database connectivity |

```json
{
  "status": "ok",
  "service": "smart-placement-management-system",
  "version": "1.0.0",
  "server_time": "2026-10-22T10:15:00+05:30",
  "database": {
    "connected": true,
    "engine": "mysql",
    "server_version": "8.0.46",
    "error": null
  }
}
```

Returns `503` with `"status": "degraded"` if the database is unreachable.

---

## 3. Authentication & accounts

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register/` | none | student self-registration (returns tokens) |
| POST | `/auth/login/` | none | exchange credentials for a token pair |
| POST | `/auth/refresh/` | none | rotate an access token |
| POST | `/auth/logout/` | bearer | blacklist the refresh token |
| GET | `/auth/me/` | bearer | current account + role profiles + permissions |
| POST | `/auth/change-password/` | bearer | change the current password |
| GET | `/auth/server-time/` | none | authoritative server clock |

### 3.1 `POST /auth/login/`

Throttled at 10 requests/minute per IP.

```json
{ "email": "student01@example.invalid", "password": "********" }
```

```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 5,
    "email": "student01@example.invalid",
    "full_name": "Aarav Sharma",
    "role": "student",
    "phone": "",
    "date_joined": "2026-10-22T09:00:00Z",
    "student_profile": {
      "id": 5, "roll_number": "SPMS001", "department": 1,
      "department_code": "CSE", "department_name": "Computer Science and Engineering",
      "cgpa": "8.50", "active_backlogs": 0, "graduation_year": 2026,
      "current_semester": 7, "is_profile_complete": true
    },
    "recruiter_profile": null,
    "permissions": ["student", "apply", "track_applications", "view_drives"]
  }
}
```

A wrong password or a deactivated account → `400` with
`code: "validation_error"`.

### 3.2 `POST /auth/register/`

Only students may self-register; the placement cell provisions admins and
recruiters.

```json
{
  "email": "new.student@example.invalid",
  "full_name": "New Student",
  "password": "Str0ng-Pass!",
  "password_confirm": "Str0ng-Pass!",
  "roll_number": "SPMS900",
  "department": 1,
  "cgpa": "7.80",
  "active_backlogs": 0,
  "graduation_year": 2026,
  "current_semester": 7,
  "phone": ""
}
```

`201` with the same `{access, refresh, user}` body as login. Rejects a duplicate
e-mail, a duplicate roll number, a weak password or mismatched passwords.

### 3.3 `POST /auth/logout/`

```json
{ "refresh": "<refresh token>" }
```

Blacklists the token (SimpleJWT `token_blacklist` app) so it cannot be replayed,
then returns `{"detail": "Signed out."}`. An already invalid token still returns
`200` — the client's session should end regardless.

---

## 4. Students

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/students/` | admin | paginated directory; `search`, `department`, `min_cgpa`, `max_cgpa`, `placed`, `graduation_year`, `active_backlogs`, `skill`, `ordering` |
| GET | `/students/departments/` | any | departments (not paginated) |
| GET | `/students/me/` | student | own profile |
| PATCH | `/students/me/` | student | update `phone, cgpa, active_backlogs, graduation_year, current_semester, resume_url, portfolio_url, linkedin_url, bio` |
| GET | `/students/me/skills/` | student | own skill list (not paginated) |
| POST | `/students/me/skills/` | student | add `{skill, proficiency_level, is_certified}` |
| PATCH/DELETE | `/students/me/skills/<id>/` | student | update / remove a skill |
| GET | `/students/<id>/` | admin | one student record |
| POST | `/students/<id>/` | admin | `{"action": "activate"｜"deactivate"}` |
| GET | `/students/<id>/skills/` | admin | skills of one student (not paginated) |
| GET/POST | `/skills/` | any / admin | skill taxonomy (POST is admin-only) |

`roll_number` is read-only after registration.

---

## 5. Companies & recruiters

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/companies/` | any | directory with `recruiter_count` and `drive_count`; `search`, `industry`, `is_active`, `ordering` |
| POST | `/companies/` | admin | create a company |
| GET | `/companies/<id>/` | any | one company |
| PATCH | `/companies/<id>/` | admin | update |
| DELETE | `/companies/<id>/` | admin | delete, or **deactivate** if it already has drives |
| GET | `/companies/<id>/drives/` | any | drives of a company (published only for non-admins) |
| GET | `/recruiters/` | admin | recruiter accounts; `search`, `company`, `is_authorized`, `can_post_jobs` |
| POST | `/recruiters/provision/` | admin | create a recruiter account |
| POST | `/recruiters/<id>/authorize/` | admin | grant drive-management rights |
| POST | `/recruiters/<id>/revoke/` | admin | withdraw those rights |

`POST /recruiters/provision/`:

```json
{
  "email": "recruiter.new@example.invalid",
  "full_name": "New Recruiter",
  "password": "Str0ng-Pass!",
  "company": 2,
  "designation": "Talent Acquisition Lead",
  "phone": "",
  "is_authorized": true,
  "can_post_jobs": true
}
```

Students and recruiters can read companies but receive `403` on any write.

---

## 6. Placement drives

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/drives/` | any | students see **published** drives only; recruiters see their own company's; admins see all. Filters: `company`, `status`, `job_type`, `drive_mode`, `search`, `ordering` |
| POST | `/drives/` | admin, recruiter | create (recruiters are forced to `draft` and to their own company) |
| GET | `/drives/<id>/` | any | one drive |
| PATCH | `/drives/<id>/` | admin; recruiter only while `draft` | update |
| DELETE | `/drives/<id>/` | admin | blocked once any application exists |
| POST | `/drives/<id>/publish/` | admin | `draft → published` (stamps `published_at`) |
| POST | `/drives/<id>/close/` | admin | `published → closed` |
| POST | `/drives/<id>/cancel/` | admin | `→ cancelled` |
| POST | `/drives/<id>/submit/` | admin, owning recruiter | flag a draft for placement-cell approval |
| GET | `/drives/<id>/eligibility/` | any | evaluate a student; students are evaluated for themselves, admins/recruiters may pass `?student_id=` |

### 6.1 Create a drive

```json
{
  "title": "Software Engineer 2027",
  "company": 1,
  "role_designation": "Software Engineer",
  "description": "Backend engineering role.",
  "job_type": "full_time",
  "drive_mode": "on_campus",
  "package_min": 600000,
  "package_max": 1200000,
  "min_cgpa": 7.0,
  "max_active_backlogs": 0,
  "allowed_departments": [1, 5],
  "min_graduation_year": 2027,
  "max_graduation_year": 2027,
  "application_deadline": "2027-01-31T18:00",
  "eligibility_notes": "Open to CSE and IT.",
  "required_skills": [
    { "skill": 1, "requirement_level": "required", "min_proficiency": 2 },
    { "skill": 4, "requirement_level": "preferred", "min_proficiency": 1 }
  ]
}
```

Validation rules: `package_max >= package_min`, `0 <= min_cgpa <= 10`,
`max_graduation_year >= min_graduation_year`, and the deadline must be in the
future. An empty `allowed_departments` list means "open to every department".

### 6.2 `GET /drives/<id>/eligibility/`

```json
{
  "eligible": false,
  "reasons": ["cgpa_below_minimum"],
  "messages": ["Minimum CGPA for this drive is 7.00; your CGPA is 6.40."],
  "details": {
    "min_cgpa": 7.0, "student_cgpa": 6.4,
    "active_backlogs": 0, "max_active_backlogs": 0,
    "required_skills": ["Python", "SQL"], "missing_skills": ["SQL"]
  }
}
```

`messages` is written for the student; `reasons` are stable machine codes.

---

## 7. Applications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/applications/` | role-scoped | admins: all; recruiters: own company; students: their own. Filters: `status`, `job_drive`, `job_drive__company`, `department`, `min_cgpa`, `max_cgpa`, `skill`, `applied_after`, `search`, `ordering` |
| POST | `/applications/` | student | submit `{job_drive, resume_url?}` |
| GET | `/applications/<id>/` | owner / company / admin | one application |
| GET | `/applications/<id>/history/` | as above | the status trail (bare array) |
| POST | `/applications/<id>/status/` | admin, recruiter, student (own, withdraw only) | `{new_status, reason?, offer_package?}` |
| PATCH | `/applications/<id>/notes/` | admin, recruiter | `{internal_notes}` (never returned to students) |
| GET | `/my-applications/` | student | own applications (bare array) |
| GET | `/application-summary/` | any | counts per status |

### 7.1 `POST /applications/`

```json
{ "job_drive": 1, "resume_url": "https://example.invalid/resume.pdf" }
```

`201` with the application. Rejected with `400` when the drive is not published,
the deadline has passed, the student is ineligible (the response carries
`reasons`/`messages`), or the student already applied — the last case is also
impossible at the database level through
`uniq_student_drive_application`.

### 7.2 Allowed status transitions

```
applied       → under_review, shortlisted, rejected, withdrawn
under_review  → shortlisted, interview, rejected, withdrawn
shortlisted   → interview, selected, not_selected, rejected, withdrawn
interview     → selected, not_selected, rejected, withdrawn
selected / rejected / withdrawn / not_selected → (terminal)
```

A student may only set `withdrawn`, and only on their own application. Any other
transition from a student → `403`. An illegal transition → `400` with a message
naming both states. Every accepted change writes an
`application_status_history` row, an `audit_logs` row and a notification.

---

## 8. Interviews

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/rounds/` | role-scoped | interview rounds; filters `job_drive`, `is_active` |
| POST | `/rounds/` | admin, owning recruiter | `{job_drive, name, sequence, description}` |
| PATCH/DELETE | `/rounds/<id>/` | as above | update / remove |
| GET | `/interviews/` | role-scoped | scheduled interviews; filters `status`, `outcome`, `round`, `mode`, `application` |
| POST | `/interviews/` | admin, owning recruiter | `{application, round, scheduled_at, duration_minutes, mode, venue, meeting_link}` |
| POST | `/interviews/<id>/outcome/` | as above | `{status?, outcome, feedback?}` |
| GET | `/my-interviews/` | student | own interviews (bare array); `?upcoming=true` |

Rules: the round must belong to the application's drive, the application must
still be in the active pipeline, and `uniq_drive_round_sequence` keeps round
numbers unique within a drive. Scheduling notifies the student; recording an
outcome notifies them again with the result.

---

## 9. Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/notifications/` | any | own notifications; `kind`, `is_read`, `unread=true`, `search` |
| POST | `/notifications/<id>/read/` | any | mark one read |
| POST | `/notifications/read-all/` | any | mark all read → `{marked_read}` |
| GET | `/notifications/unread-count/` | any | `{unread}` badge counter |
| POST | `/notifications/broadcast/` | admin | `{kind, title, message, audience}` → `{delivered}` |
| GET | `/notification-stats/` | any | `{unread, by_kind: [{kind, count}]}` |

A user can never read another user's notifications — the queryset is filtered by
`recipient = request.user` at the database level.

---

## 10. Reporting & audit

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/dashboard/` | any | role-aware metric payload |
| GET | `/analytics/` | any | departments, companies, funnel, packages, top recruiters, drives |
| GET | `/reports/departments/` | admin | department-wise placement statistics |
| GET | `/reports/companies/` | admin | company-wise recruitment statistics |
| GET | `/reports/funnel/` | any | application counts per status |
| GET | `/reports/drives/` | any | drive-wise application/shortlist/selection counts |
| GET | `/reports/export/` | admin | catalogue of available CSV exports |
| GET | `/reports/export/{students｜applications｜companies｜drives}/` | admin | CSV download |
| GET | `/audit-logs/` | admin | paginated audit trail; `action`, `entity_type`, `search`, `ordering` |

### 10.1 `GET /dashboard/` (admin)

```json
{
  "total_students": 24,
  "eligible_students": 24,
  "total_companies": 6,
  "total_drives": 9,
  "active_drives": 7,
  "total_applications": 18,
  "placed_students": 2,
  "unplaced_students": 22,
  "placement_rate": 8.33,
  "average_package": 1200000.0,
  "scheduled_interviews": 4,
  "generated_at": "2026-10-22T10:20:00+05:30",
  "role": "admin"
}
```

### 10.2 CSV exports

Responses are `text/csv` with `Content-Disposition: attachment` and
`Cache-Control: no-store`. Any cell that begins with `= + - @ tab CR LF` is
prefixed with a single quote so a spreadsheet renders it as text rather than
executing it (CSV formula-injection defence).

---

## 11. Quick reference: complete route map

```
/api/v1/health/
/api/v1/auth/{register,login,refresh,logout,me,change-password,server-time}/
/api/v1/students/{,me/,departments/,my/skills/,<id>/skills/,<id>/}
/api/v1/skills/
/api/v1/companies/{,<id>/,<id>/drives/}
/api/v1/recruiters/{,provision/,<id>/authorize/,<id>/revoke/}
/api/v1/drives/{,<id>/,<id>/{publish,close,cancel,submit,eligibility}/}
/api/v1/applications/{,<id>/,<id>/{history,status,notes}/}
/api/v1/my-applications/
/api/v1/application-summary/
/api/v1/rounds/{,<id>/}
/api/v1/interviews/{,<id>/outcome/}
/api/v1/my-interviews/
/api/v1/notifications/{,<id>/read/,read-all/,unread-count/,broadcast/}
/api/v1/notification-stats/
/api/v1/dashboard/
/api/v1/analytics/
/api/v1/reports/{departments,companies,funnel,drives,export}/
/api/v1/reports/export/{students,applications,companies,drives}/
/api/v1/audit-logs/{,<id>/}
/api/v1/            (service description)
```

Query parameters shared by list endpoints: `?page=`, `?page_size=` (≤ 100),
`?search=`, `?ordering=` (prefix with `-` for descending) plus the per-endpoint
filters listed above.
