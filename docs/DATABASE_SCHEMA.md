# Database Schema

Database: **MySQL 8** · engine **InnoDB** · character set **utf8mb4** ·
collation **utf8mb4_0900_ai_ci** · isolation level **READ COMMITTED** ·
`sql_mode` includes **STRICT_TRANS_TABLES**.

The schema is produced only by Django migrations (`python manage.py migrate`);
no table is ever created by hand. A knowledge-base view of the live database
after `migrate` + `seed_demo_data`:

| # | Table | Purpose |
|---|---|---|
| 1 | `users` | every account (custom user model, e-mail login) |
| 2 | `departments` | academic departments (reference data) |
| 3 | `student_profiles` | academic record of a student account |
| 4 | `recruiter_profiles` | company-side profile of a recruiter account |
| 5 | `companies` | recruiting organisations |
| 6 | `skills` | shared skill taxonomy |
| 7 | `student_skills` | junction: student × skill |
| 8 | `job_drives` | placement drives (job openings) |
| 9 | `job_drive_skills` | junction: drive × skill requirement |
| 10 | `job_drives_allowed_departments` | junction: drive × eligible department |
| 11 | `applications` | a student's application to a drive |
| 12 | `application_status_history` | append-only pipeline audit trail |
| 13 | `interview_rounds` | ordered stages of a drive |
| 14 | `interviews` | a scheduled interview session |
| 15 | `notifications` | in-app notifications |
| 16 | `audit_logs` | administrative audit trail |

Tables 1–16 are the application schema; numbers 1–15 are the explicitly named
business tables. Django additionally creates `django_*`, `auth_*`,
`token_blacklist_*` and the `users_groups` / `users_user_permissions` join tables
— 27 tables in total, verified against the live database.

---

## 1. `users`

Custom user model (`AUTH_USER_MODEL = accounts.User`). E-mail is the login
identifier; `role` is a first-class column so permissions never rely on group
membership.

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK, AUTO_INCREMENT |
| `password` | VARCHAR(128) | NOT NULL (PBKDF2 hash) |
| `last_login` | DATETIME(6) | NULL |
| `is_superuser` | BOOL | NOT NULL |
| `email` | VARCHAR(254) | NOT NULL, **UNIQUE**, indexed |
| `full_name` | VARCHAR(150) | NOT NULL |
| `role` | VARCHAR(20) | NOT NULL, indexed (`admin`/`student`/`recruiter`) |
| `phone` | VARCHAR(20) | NOT NULL, default `''` |
| `is_active` | BOOL | NOT NULL, indexed |
| `is_staff` | BOOL | NOT NULL |
| `date_joined` | DATETIME(6) | NOT NULL |
| `created_at` | DATETIME(6) | NOT NULL, indexed |
| `updated_at` | DATETIME(6) | NOT NULL |

Composite index: `user_role_active_idx (role, is_active)`.

---

## 2. `student_profiles`

One row per student account (`user_id` is UNIQUE → 1-to-1).

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `roll_number` | VARCHAR(20) | NOT NULL, **UNIQUE**, indexed, regex `^[A-Za-z0-9]{2,20}$` |
| `department_id` | BIGINT | NOT NULL, FK → `departments.id` (`PROTECT`) |
| `cgpa` | DECIMAL(4,2) | NOT NULL, 0.00 – 10.00 |
| `active_backlogs` | INT UNSIGNED | NOT NULL, default 0 |
| `graduation_year` | INT UNSIGNED | NOT NULL, indexed |
| `current_semester` | SMALLINT UNSIGNED | NOT NULL |
| `phone` | VARCHAR(20) | NOT NULL, default `''` |
| `resume_url` | VARCHAR(500) | NOT NULL, default `''` (URL only, no upload) |
| `portfolio_url` | VARCHAR(300) | NOT NULL, default `''` |
| `linkedin_url` | VARCHAR(300) | NOT NULL, default `''` |
| `bio` | LONGTEXT | NOT NULL, ≤ 1000 chars |
| `is_profile_complete` | BOOL | NOT NULL, kept in sync on save |
| `user_id` | BIGINT | NOT NULL, **UNIQUE**, FK → `users.id` (`CASCADE`) |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Indexes: `student_dept_year_idx (department_id, graduation_year)`,
`student_cgpa_idx (cgpa)`.

---

## 3. `recruiter_profiles`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `user_id` | BIGINT | NOT NULL, **UNIQUE**, FK → `users.id` (`CASCADE`) |
| `company_id` | BIGINT | NULL, FK → `companies.id` (`PROTECT`) |
| `designation` | VARCHAR(120) | NOT NULL, default `''` |
| `phone` | VARCHAR(20) | NOT NULL, default `''` |
| `is_authorized` | BOOL | NOT NULL, default **FALSE** |
| `can_post_jobs` | BOOL | NOT NULL, default TRUE |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Index: `recruiter_company_auth_idx (company_id, is_authorized)`.

---

## 4. `departments`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `code` | VARCHAR(16) | NOT NULL, **UNIQUE**, indexed |
| `name` | VARCHAR(120) | NOT NULL, **UNIQUE** |
| `description` | LONGTEXT | NOT NULL |
| `annual_intake` | INT UNSIGNED | NOT NULL, default 0 |
| `is_active` | BOOL | NOT NULL, default TRUE |
| `created_at` | DATETIME(6) | NOT NULL |

---

## 5. `companies`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `name` | VARCHAR(180) | NOT NULL, **UNIQUE**, indexed |
| `slug` | VARCHAR(200) | NOT NULL, **UNIQUE** (derived from `name`) |
| `industry` | VARCHAR(32) | NOT NULL, indexed (`it`, `it_services`, `product`, `consulting`, `finance`, `automotive`, `healthcare`, `telecom`, `energy`, `education`, `other`) |
| `website` | VARCHAR(300) | NOT NULL, default `''` |
| `logo_url` | VARCHAR(500) | NOT NULL, default `''` |
| `location` | VARCHAR(180) | NOT NULL, default `''` |
| `description` | LONGTEXT | NOT NULL |
| `hr_contact_email` | VARCHAR(254) | NOT NULL, default `''` |
| `hr_contact_phone` | VARCHAR(20) | NOT NULL, default `''` |
| `is_active` | BOOL | NOT NULL, indexed |
| `created_by_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Index: `company_active_industry_idx (is_active, industry)`.

---

## 6. `skills` + 7. `student_skills`

`skills` — the shared taxonomy:

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `name` | VARCHAR(80) | NOT NULL, **UNIQUE**, indexed |
| `slug` | VARCHAR(100) | NOT NULL, **UNIQUE** |
| `category` | VARCHAR(60) | NOT NULL, default `''` |
| `created_at` | DATETIME(6) | NOT NULL |

`student_skills` — a student's declared proficiency:

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `student_id` | BIGINT | NOT NULL, FK → `student_profiles.id` (`CASCADE`) |
| `skill_id` | BIGINT | NOT NULL, FK → `skills.id` (`CASCADE`) |
| `proficiency_level` | SMALLINT UNSIGNED | NOT NULL, 1–5, default 3 |
| `is_certified` | BOOL | NOT NULL, default FALSE |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

**Constraint:** `uniq_student_skill UNIQUE (student_id, skill_id)`.

---

## 8. `job_drives`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `title` | VARCHAR(180) | NOT NULL, indexed |
| `company_id` | BIGINT | NOT NULL, FK → `companies.id` (`PROTECT`) |
| `role_designation` | VARCHAR(150) | NOT NULL |
| `description` | LONGTEXT | NOT NULL |
| `job_type` | VARCHAR(20) | NOT NULL (`full_time`/`internship`) |
| `drive_mode` | VARCHAR(20) | NOT NULL (`on_campus`/`off_campus`/`online`) |
| `package_min` | DECIMAL(12,2) | NOT NULL, ≥ 0 |
| `package_max` | DECIMAL(12,2) | NOT NULL, ≥ `package_min` (checked in the serializer) |
| `min_cgpa` | DECIMAL(4,2) | **NULL** = no CGPA restriction |
| `max_active_backlogs` | INT UNSIGNED | **NULL** = unlimited |
| `min_graduation_year` | INT UNSIGNED | NULL |
| `max_graduation_year` | INT UNSIGNED | NULL |
| `application_deadline` | DATETIME(6) | NOT NULL, indexed |
| `published_at` | DATETIME(6) | NULL |
| `submitted_at` | DATETIME(6) | NULL (recruiter sent the draft for approval) |
| `status` | VARCHAR(16) | NOT NULL, indexed (`draft`/`published`/`closed`/`cancelled`) |
| `eligibility_notes` | LONGTEXT | NOT NULL |
| `created_by_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `closed_at` | DATETIME(6) | NULL |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Indexes: `drive_status_deadline_idx (status, application_deadline)`,
`drive_company_status_idx (company_id, status)`, `drive_created_idx (created_at DESC)`.

---

## 9. `job_drive_skills` + 10. `job_drives_allowed_departments`

`job_drive_skills`:

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `job_drive_id` | BIGINT | NOT NULL, FK → `job_drives.id` (`CASCADE`) |
| `skill_id` | BIGINT | NOT NULL, FK → `skills.id` (`CASCADE`) |
| `requirement_level` | VARCHAR(16) | NOT NULL (`required`/`preferred`) |
| `min_proficiency` | SMALLINT UNSIGNED | NOT NULL, 1–5 |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

**Constraint:** `uniq_drive_skill UNIQUE (job_drive_id, skill_id)`.

`job_drives_allowed_departments` (Django-managed M2M through table):
`UNIQUE (jobdrive_id, department_id)`, both columns FK with `CASCADE`. An empty
set means "open to every department".

---

## 11. `applications`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `student_id` | BIGINT | NOT NULL, FK → `student_profiles.id` (`CASCADE`) |
| `job_drive_id` | BIGINT | NOT NULL, FK → `job_drives.id` (`CASCADE`) |
| `status` | VARCHAR(20) | NOT NULL, indexed (8-state pipeline) |
| `applied_at` | DATETIME(6) | NOT NULL, indexed |
| `status_changed_at` | DATETIME(6) | NULL |
| `shortlisted_at` | DATETIME(6) | NULL |
| `selected_at` | DATETIME(6) | NULL |
| `withdrawn_at` | DATETIME(6) | NULL |
| `offer_package` | DECIMAL(12,2) | NULL |
| `rejection_reason` | LONGTEXT | NOT NULL |
| `internal_notes` | LONGTEXT | NOT NULL — stripped for student callers |
| `eligibility_snapshot` | JSON | NOT NULL, default `{}` |
| `resume_url` | VARCHAR(500) | NOT NULL |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

**Constraints**

* `uniq_student_drive_application UNIQUE (student_id, job_drive_id)` — the
  database-level guarantee against a duplicate application.
* `application_offer_package_non_negative CHECK (offer_package IS NULL OR offer_package >= 0)`.

Indexes: `app_status_applied_idx (status, applied_at DESC)`,
`app_drive_status_idx (job_drive_id, status)`,
`app_student_status_idx (student_id, status)`.

---

## 12. `application_status_history`

Append-only. One row per accepted transition, written in the same transaction as
the status change.

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `application_id` | BIGINT | NOT NULL, FK → `applications.id` (`CASCADE`) |
| `from_status` | VARCHAR(20) | NOT NULL, `''` for the creation event |
| `to_status` | VARCHAR(20) | NOT NULL, indexed |
| `changed_by_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `changed_by_role` | VARCHAR(20) | NOT NULL (snapshot of the actor's role) |
| `reason` | VARCHAR(500) | NOT NULL |
| `changed_at` | DATETIME(6) | NOT NULL, indexed |

Index: `apphist_app_time_idx (application_id, changed_at DESC)`.

---

## 13. `interview_rounds` + 14. `interviews`

`interview_rounds`:

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `job_drive_id` | BIGINT | NOT NULL, FK → `job_drives.id` (`CASCADE`) |
| `name` | VARCHAR(120) | NOT NULL |
| `sequence` | SMALLINT UNSIGNED | NOT NULL, indexed |
| `description` | LONGTEXT | NOT NULL |
| `is_active` | BOOL | NOT NULL, default TRUE |
| `created_by_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

**Constraint:** `uniq_drive_round_sequence UNIQUE (job_drive_id, sequence)`.

`interviews`:

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `application_id` | BIGINT | NOT NULL, FK → `applications.id` (`CASCADE`) |
| `round_id` | BIGINT | NOT NULL, FK → `interview_rounds.id` (`PROTECT`) |
| `scheduled_at` | DATETIME(6) | NOT NULL, indexed |
| `duration_minutes` | SMALLINT UNSIGNED | NOT NULL, default 60 |
| `mode` | VARCHAR(16) | NOT NULL (`online`/`offline`/`phone`) |
| `venue` | VARCHAR(180) | NOT NULL |
| `meeting_link` | VARCHAR(400) | NOT NULL |
| `status` | VARCHAR(16) | NOT NULL, indexed |
| `outcome` | VARCHAR(16) | NOT NULL, indexed (`pending`/`passed`/`failed`) |
| `feedback` | LONGTEXT | NOT NULL |
| `scheduled_by_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `completed_at` | DATETIME(6) | NULL |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Indexes: `interview_status_time_idx (status, scheduled_at)`,
`interview_round_time_idx (round_id, scheduled_at)`.

---

## 15. `notifications`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `recipient_id` | BIGINT | NOT NULL, FK → `users.id` (`CASCADE`) |
| `kind` | VARCHAR(20) | NOT NULL, indexed |
| `title` | VARCHAR(180) | NOT NULL |
| `message` | LONGTEXT | NOT NULL |
| `link` | VARCHAR(300) | NOT NULL |
| `is_read` | BOOL | NOT NULL, indexed |
| `read_at` | DATETIME(6) | NULL |
| `created_at` / `updated_at` | DATETIME(6) | NOT NULL |

Index: `notif_unread_idx (recipient_id, is_read, created_at DESC)`.

---

## 16. `audit_logs`

| Column | Type | Constraints |
|---|---|---|
| `id` | BIGINT | PK |
| `actor_id` | BIGINT | NULL, FK → `users.id` (`SET NULL`) |
| `actor_email` | VARCHAR(254) | NOT NULL — denormalised so the trail survives deletion |
| `action` | VARCHAR(32) | NOT NULL, indexed |
| `entity_type` | VARCHAR(64) | NOT NULL, indexed |
| `entity_id` | VARCHAR(64) | NOT NULL, indexed |
| `description` | LONGTEXT | NOT NULL |
| `metadata` | JSON | NOT NULL, default `{}` |
| `ip_address` | CHAR(39) | NULL |
| `created_at` | DATETIME(6) | NOT NULL, indexed |

Indexes: `audit_entity_idx (entity_type, entity_id)`,
`audit_action_idx (action, created_at DESC)`.

---

## Normalization

The schema is in **third normal form**. The reasoning, stage by stage:

### Unnormalised form (what we avoided)

A naive placement "spreadsheet" would look like:

```
application(roll_number, student_name, department, dept_hod, company, company_hr_email,
            drive_title, package, skills_csv, status, status_history_csv)
```

Problems: repeating groups (`skills_csv`, `status_history_csv`), a phone-book
list inside a cell, and the same company e-mail copied onto every row.

### First normal form (1NF) — atomic values, no repeating groups

* Skills become their own table `skills`, related to students through
  `student_skills` and to drives through `job_drive_skills`.
* The pipeline trail becomes `application_status_history`, one row per change.
* Multiple eligible departments per drive become the junction table
  `job_drives_allowed_departments`.
* Every column holds a single scalar.

### Second normal form (2NF) — no partial dependency

Every table has a surrogate `BIGINT` primary key and all non-key attributes
depend on the **whole** key.

* `student_skills` is keyed by `id`, and its natural key
  `UNIQUE(student_id, skill_id)` removes the partial dependency that would exist
  if `proficiency_level` depended on only one of the two columns.
* `job_drive_skills` mirrors that pattern with `UNIQUE(job_drive_id, skill_id)`.
* `interview_rounds` uses `UNIQUE(job_drive_id, sequence)` so `name` depends on
  the drive *and* the ordering, never on the drive alone.

### Third normal form (3NF) — no transitive dependency

* `student_profiles` stores `department_id`, not `department_name`/`dept_hod`;
  the name lives once in `departments`. Transitive dependency removed.
* `job_drives` stores `company_id`, not `company_name`/`hr_contact_email`;
  company attributes live once in `companies`.
* `recruiter_profiles` reaches the company only through `company_id`, never
  through a duplicated company name.
* `applications` stores `student_id` + `job_drive_id`. It does **not** store the
  student's CGPA or the drive's package as the source of truth — those are read
  by join. (The one deliberate exception is the JSON snapshot, below.)

### Deliberate, documented redundancy

Four small denormalisations are intentional and each has a business reason. They
are *snapshots*, not duplicates of live data:

| Denormalisation | Why it is not a 3NF violation in practice |
|---|---|
| `applications.eligibility_snapshot` (JSON) | An audit record of the criteria **as they were at submission time**. If the drive's CGPA cut-off is later edited, the historical decision must not change. |
| `applications.status_changed_at / shortlisted_at / selected_at / withdrawn_at` | Timestamped pipeline milestones used by the analytics queries. Deriving them from history on every dashboard load would add a correlated subquery per row for no benefit. |
| `audit_logs.actor_email` | The audit trail must remain readable after the account is deleted (`actor_id` is `SET NULL`). |
| `application_status_history.changed_by_role` | Records the role **at the time of the action**; an account can be re-provisioned with a different role later. |

Everything else is fully normalised: no derived column is stored, and no
attribute of one entity is repeated in another.

---

## Constraint summary

| Kind | Count | Examples |
|---|---|---|
| Primary keys | 16 | every table |
| Foreign keys | 19 | `applications.student_id`, `job_drives.company_id`, … |
| Unique constraints | 13 | `users.email`, `applications(student_id, job_drive_id)`, `interview_rounds(job_drive_id, sequence)` |
| Check constraints | 1 | `applications.offer_package >= 0` (`application_offer_package_non_negative`) |
| Named indexes | 15 | `drive_status_deadline_idx`, `app_status_applied_idx`, `notif_unread_idx` |

Verification command (after `migrate`):

```sql
SELECT table_name, index_name, non_unique
FROM information_schema.statistics
WHERE table_schema = 'placement_management'
ORDER BY table_name, index_name;
```
