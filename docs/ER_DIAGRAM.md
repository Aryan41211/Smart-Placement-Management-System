# Entity–Relationship Diagram

The diagram below is generated from the real Django models
(`backend/<app>/models.py`). Every entity maps to a physical table whose
`db_table` name is shown in the `[table]` label, so the picture and
`docs/DATABASE_SCHEMA.md` describe the same database.

Cardinality legend: `||--o{` one-to-many (mandatory one side),
`||--o|` one-to-zero-or-one, `}o--o{` many-to-many.

```mermaid
erDiagram
    USERS["users"] {
        bigint   id PK
        varchar  email UK "login identifier"
        varchar  full_name
        varchar  role "admin | student | recruiter"
        varchar  phone
        boolean  is_active
        boolean  is_staff
        datetime date_joined
    }

    DEPARTMENTS["departments"] {
        bigint  id PK
        varchar code UK
        varchar name UK
        int     annual_intake
        boolean is_active
    }

    STUDENT_PROFILES["student_profiles"] {
        bigint  id PK
        bigint  user_id FK,UK
        varchar roll_number UK
        bigint  department_id FK
        decimal cgpa "0.00-10.00"
        int     active_backlogs
        int     graduation_year
        smallint current_semester
        varchar resume_url
        boolean is_profile_complete
    }

    RECRUITER_PROFILES["recruiter_profiles"] {
        bigint  id PK
        bigint  user_id FK,UK
        bigint  company_id FK "nullable"
        varchar designation
        boolean is_authorized
        boolean can_post_jobs
    }

    COMPANIES["companies"] {
        bigint  id PK
        varchar name UK
        varchar slug UK
        varchar industry
        varchar location
        varchar hr_contact_email
        boolean is_active
        bigint  created_by_id FK
    }

    SKILLS["skills"] {
        bigint  id PK
        varchar name UK
        varchar slug UK
        varchar category
    }

    STUDENT_SKILLS["student_skills"] {
        bigint   id PK
        bigint   student_id FK
        bigint   skill_id FK
        smallint proficiency_level "1..5"
        boolean  is_certified
    }

    JOB_DRIVES["job_drives"] {
        bigint   id PK
        varchar  title
        bigint   company_id FK
        varchar  role_designation
        varchar  job_type "full_time | internship"
        varchar  drive_mode "on_campus | off_campus | online"
        decimal  package_min
        decimal  package_max
        decimal  min_cgpa "nullable = no limit"
        int      max_active_backlogs "nullable = no limit"
        int      min_graduation_year
        int      max_graduation_year
        datetime application_deadline
        varchar  status "draft|published|closed|cancelled"
        bigint   created_by_id FK
    }

    JOB_DRIVE_SKILLS["job_drive_skills"] {
        bigint   id PK
        bigint   job_drive_id FK
        bigint   skill_id FK
        varchar  requirement_level "required | preferred"
        smallint min_proficiency "1..5"
    }

    DRIVE_DEPARTMENTS["job_drives_allowed_departments"] {
        bigint id PK
        bigint jobdrive_id FK
        bigint department_id FK
    }

    APPLICATIONS["applications"] {
        bigint   id PK
        bigint   student_id FK
        bigint   job_drive_id FK
        varchar  status "8-state pipeline"
        datetime applied_at
        datetime status_changed_at
        decimal  offer_package "nullable, >= 0"
        text     rejection_reason
        text     internal_notes "hidden from students"
        json     eligibility_snapshot
        varchar  resume_url
    }

    APPLICATION_STATUS_HISTORY["application_status_history"] {
        bigint   id PK
        bigint   application_id FK
        varchar  from_status
        varchar  to_status
        bigint   changed_by_id FK "nullable"
        varchar  changed_by_role
        varchar  reason
        datetime changed_at
    }

    INTERVIEW_ROUNDS["interview_rounds"] {
        bigint   id PK
        bigint   job_drive_id FK
        varchar  name
        smallint sequence
        boolean  is_active
    }

    INTERVIEWS["interviews"] {
        bigint   id PK
        bigint   application_id FK
        bigint   round_id FK
        datetime scheduled_at
        smallint duration_minutes
        varchar  mode "online | offline | phone"
        varchar  venue
        varchar  meeting_link
        varchar  status "scheduled|completed|cancelled|no_show"
        varchar  outcome "pending | passed | failed"
        text     feedback
        datetime completed_at
    }

    NOTIFICATIONS["notifications"] {
        bigint   id PK
        bigint   recipient_id FK
        varchar  kind
        varchar  title
        text     message
        varchar  link
        boolean  is_read
        datetime read_at
    }

    AUDIT_LOGS["audit_logs"] {
        bigint  id PK
        bigint  actor_id FK "nullable"
        varchar actor_email "denormalised snapshot"
        varchar action
        varchar entity_type
        varchar entity_id
        text    description
        json    metadata
        varchar ip_address
        datetime created_at
    }

    %% ---------- relationships ----------
    USERS            ||--o| STUDENT_PROFILES   : "has one academic profile"
    USERS            ||--o| RECRUITER_PROFILES : "has one company profile"
    USERS            ||--o{ JOB_DRIVES         : "creates"
    USERS            ||--o{ NOTIFICATIONS      : "receives"
    USERS            ||--o{ AUDIT_LOGS         : "acts (actor_id)"
    USERS            ||--o{ COMPANIES          : "creates (created_by_id)"

    DEPARTMENTS      ||--o{ STUDENT_PROFILES   : "enrols"
    DEPARTMENTS      }o--o{ JOB_DRIVES         : "is opened to (M2M)"

    COMPANIES        ||--o{ RECRUITER_PROFILES  : "employs"
    COMPANIES        ||--o{ JOB_DRIVES          : "publishes"

    SKILLS           ||--o{ STUDENT_SKILLS      : "tagged on"
    SKILLS           ||--o{ JOB_DRIVE_SKILLS    : "required by"

    STUDENT_PROFILES ||--o{ STUDENT_SKILLS      : "declares"
    STUDENT_PROFILES ||--o{ APPLICATIONS        : "submits"

    JOB_DRIVES       ||--o{ JOB_DRIVE_SKILLS    : "requires"
    JOB_DRIVES       ||--o{ APPLICATIONS        : "receives"
    JOB_DRIVES       ||--o{ INTERVIEW_ROUNDS    : "defines"

    APPLICATIONS     ||--o{ APPLICATION_STATUS_HISTORY : "is audited by"
    APPLICATIONS     ||--o{ INTERVIEWS          : "is scheduled for"

    INTERVIEW_ROUNDS ||--o{ INTERVIEWS          : "hosts"
```

---

## Integrity rules shown in the diagram

These are enforced by the database, not only by application code.

| Table | Rule | Kind |
|---|---|---|
| `users` | `email` unique; `(role, is_active)` indexed | UNIQUE + INDEX |
| `student_profiles` | `roll_number` unique; `user_id` unique (1-to-1); `cgpa` validated 0–10 | UNIQUE + CHECK |
| `recruiter_profiles` | `user_id` unique; `(company, is_authorized)` indexed | UNIQUE + INDEX |
| `departments` | `code` and `name` unique | UNIQUE |
| `companies` | `name` and `slug` unique; `(is_active, industry)` indexed | UNIQUE + INDEX |
| `skills` | `name` and `slug` unique | UNIQUE |
| `student_skills` | `UNIQUE(student_id, skill_id)` — no duplicate skill rows | UNIQUE |
| `job_drives` | `(status, application_deadline)`, `(company, status)` indexed | INDEX |
| `job_drive_skills` | `UNIQUE(job_drive_id, skill_id)` | UNIQUE |
| `applications` | `UNIQUE(student_id, job_drive_id)` — one application per student per drive | UNIQUE |
| `applications` | `CHECK (offer_package IS NULL OR offer_package >= 0)` | CHECK |
| `application_status_history` | `(application_id, changed_at)` indexed | INDEX |
| `interview_rounds` | `UNIQUE(job_drive_id, sequence)` — rounds cannot share a number | UNIQUE |
| `interviews` | `(status, scheduled_at)`, `(round, scheduled_at)` indexed | INDEX |
| `notifications` | `(recipient_id, is_read, created_at)` indexed for the badge count | INDEX |
| `audit_logs` | `(entity_type, entity_id)` and `(action, created_at)` indexed | INDEX |

### Referential actions

| Relationship | `ON DELETE` | Rationale |
|---|---|---|
| `student_profiles → users` | `CASCADE` | deleting an account removes its profile |
| `applications → student_profiles` | `CASCADE` | a removed student cannot hold applications |
| `applications → job_drives` | `CASCADE` | drives are only deletable with no applications (blocked in the view) |
| `job_drives → companies` | `PROTECT` | a company with drives cannot be deleted (the view deactivates it) |
| `interviews → interview_rounds` | `PROTECT` | a round with bookings cannot be deleted |
| `audit_logs → users` | `SET NULL` | the trail must outlive the account (hence `actor_email`) |
| `job_drives → users (created_by)` | `SET NULL` | deleting an officer must not delete historical drives |
