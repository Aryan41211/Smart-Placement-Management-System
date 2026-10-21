# Viva Questions & Answers

36 questions an examiner is likely to ask about this project, with direct
answers grounded in the actual implementation. Numbers refer to the real files
(`backend/<app>/…`, `docs/…`).

---

## Schema & keys

### 1. Why did you choose MySQL over SQLite for a college DBMS project?

The point of the project is to demonstrate relational database features that
SQLite only partially supports: real `InnoDB` transactions with row-level
locking (`SELECT … FOR UPDATE`), `CHECK` constraints, strict `sql_mode`,
character-set/collation control (`utf8mb4_0900_ai_ci`), `EXPLAIN` plans and
multiple concurrent connections served by a separate server process. SQLite is a
library, not a database server, so it would not exercise those features.

### 2. What is the primary key of every table and why a surrogate key?

Every table uses a `BIGINT AUTO_INCREMENT` surrogate primary key. The *natural*
key (for example `roll_number` on `student_profiles` or `email` on `users`) is
still enforced with a `UNIQUE` constraint. The surrogate key keeps foreign keys
small and stable even if a natural key like a roll number is corrected, and it
avoids a cascade of updates if a natural key ever changes.

### 3. Which unique constraints exist, and which one is the most important?

Thirteen. The most important is
`uniq_student_drive_application UNIQUE (student_id, job_drive_id)` on
`applications`: it makes a duplicate application *physically impossible*, not
merely "checked in code". Others include `users.email`, `student_profiles.roll_number`,
`job_drive_skills (job_drive_id, skill_id)`, `student_skills (student_id, skill_id)`
and `interview_rounds (job_drive_id, sequence)`.

### 4. Why is `applications.student_id` part of a unique constraint instead of a primary key?

An application is not identified by its student — one student has many
applications. The primary key is the surrogate `id`; the pair
`(student_id, job_drive_id)` is a *unique candidate key* that encodes the real
business rule.

### 5. Where are the one-to-one relationships?

`student_profiles.user_id` and `recruiter_profiles.user_id` are both `UNIQUE`
foreign keys to `users.id`. That uniqueness is what turns the relationship into
1-to-1 rather than 1-to-many.

### 6. Explain the many-to-many relationships and their junction tables.

* `student_profiles ↔ skills` through `student_skills` (with `proficiency_level`,
  `is_certified`).
* `job_drives ↔ skills` through `job_drive_skills` (with `requirement_level`,
  `min_proficiency`).
* `job_drives ↔ departments` through `job_drives_allowed_departments`.

Each junction carries attributes or constraints of its own, which is exactly why
a junction *table* is used rather than a CSV column.

### 7. What foreign key delete rules did you choose and why?

| Relation | Rule | Reason |
|---|---|---|
| `student_profiles → users` | `CASCADE` | a profile cannot exist without its account |
| `applications → job_drives` | `CASCADE` | plus a view guard: a drive with applications is not deletable |
| `job_drives → companies` | `PROTECT` | a company with drives must be deactivated, not deleted |
| `interviews → interview_rounds` | `PROTECT` | a round with bookings must survive |
| `audit_logs → users` | `SET NULL` | the trail must outlive the account (`actor_email` keeps readability) |
| `job_drives → users (created_by)` | `SET NULL` | deleting an officer must not delete historical drives |

`PROTECT` is the deliberate default for anything the placement cell must not
lose; `CASCADE` is used only where the child is meaningless without the parent.

---

## Normalisation

### 8. Show the schema is in 1NF.

Every column holds a single atomic value and no table stores repeating groups.
Skills are not a CSV column — they live in `skills` with two junction tables.
The pipeline history is not a JSON blob on the application — it is
`application_status_history`, one row per transition.

### 9. Show the schema is in 2NF.

Every table has a single-column surrogate primary key, so a partial dependency
on a composite key is structurally impossible. Where a *natural* composite key
exists it is enforced with `UNIQUE` (for example `(student_id, skill_id)`), which
is where a partial dependency would otherwise hide.

### 10. Show the schema is in 3NF and name a transitive dependency you removed.

`student_profiles` stores `department_id`, not the department name or HOD: the
name lives once in `departments`, so there is no
`id → department_id → department_name` chain. Likewise `job_drives` stores
`company_id`, not the company name or HR e-mail. `recruiter_profiles` reaches the
company only through `company_id`.

### 11. You store redundant data in `applications.eligibility_snapshot`. Isn't that a 3NF violation?

It is a deliberate, documented exception of the *snapshot* kind. The JSON records
the criteria **as they were when the student applied**. If the officer later
edits the drive's CGPA cut-off, the historical decision must not silently change.
A snapshot is an audit fact, not a duplicate of live data. The same reasoning
applies to `status_changed_at`/`shortlisted_at`/`selected_at`/`withdrawn_at`
(pipeline milestones) and to `audit_logs.actor_email` (survives account
deletion). All four are listed in `docs/DATABASE_SCHEMA.md`.

### 12. Is the schema in BCNF?

Yes for the normalised tables: in each of them every determinant is a candidate
key (`id`, or a `UNIQUE` natural key). The four documented snapshots are the only
exceptions, and each is intentional.

### 13. What would a denormalised version look like, and why did you reject it?

A single `application` table with `student_name`, `department`, `company`,
`skills_csv`, `history_csv` would avoid joins, but it would duplicate the company
name onto every row (update anomaly), allow spelling drift in departments
(insert anomaly) and lose history when a row is deleted (delete anomaly). It
would also break the duplicate-application guarantee.

---

## Indexes & performance

### 14. Which indexes did you add, and which query does each serve?

| Index | Serves |
|---|---|
| `drive_status_deadline_idx (status, application_deadline)` | the "active drives" dashboard count and the student catalogue |
| `drive_company_status_idx (company_id, status)` | a recruiter's drive list |
| `app_status_applied_idx (status, applied_at desc)` | the funnel `GROUP BY status` and recent-activity feed |
| `app_drive_status_idx`, `app_student_status_idx` | drive-wise and student-wise application lookups |
| `student_cgpa_idx`, `student_dept_year_idx` | the eligibility scan and directory filters |
| `notif_unread_idx (recipient_id, is_read, created_at desc)` | the unread badge count |
| `audit_action_idx`, `audit_entity_idx` | filtering the audit trail |

### 15. What does `EXPLAIN` show for the funnel query?

Against the live database it reports `type: index`, `key:
app_status_applied_idx`, `Extra: Using where; Using index` — a covering index
scan rather than a full table scan. The directory query uses `type: ref` on
`student_dept_year_idx`.

### 16. Why does the dashboard not recompute counts in Python?

Because `reports/services.py` pushes `COUNT`/`AVG`/`SUM`/`GROUP BY` into MySQL.
It is faster (one round trip, no row transfer), it is the DBMS skill the project
is meant to demonstrate, and it removes any chance of the client showing a
hard-coded number.

### 17. What is an N+1 query problem and how is it avoided here?

Fetching a list and then issuing one query per row for a related object. The
views call `select_related()` for foreign keys (student → user, drive → company)
and `prefetch_related()` for many-to-many data (`required_skills__skill`,
`allowed_departments`), collapsing it to a constant number of queries.

### 18. Would you ever use `SELECT *` in this project?

No. The ORM and the documented queries always name columns, so indexes can cover
the query and large text columns (`description`, `internal_notes`) are not
dragged into list payloads needlessly.

---

## Transactions, concurrency & ACID

### 19. Where exactly do you use a transaction?

`applications/services.py` wraps both `submit_application` and
`transition_application` in `@transaction.atomic`. The status change, the
`application_status_history` insert and the `audit_logs` insert commit together
or not at all.

### 20. Explain the race condition in "apply" and how you prevent it.

Two requests could both pass an "already applied?" check and both insert. The
fix is to re-read the drive with `select_for_update()` **inside** the
transaction, which takes an exclusive row lock, and to rely on
`uniq_student_drive_application` as the final backstop. The second request either
waits and then sees the existing row, or is rejected by the unique index with
`IntegrityError` (mapped to `409 Conflict`).

### 21. Why lock the *drive* row and not the application?

The drive is the shared resource whose state (open/closed, deadline) both
transactions read. Locking it serialises the decision. Locking a not-yet-existing
application row is impossible.

### 22. Demonstrate that the project is ACID-compliant.

* **Atomicity** — a failed transition writes no history row (same transaction).
* **Consistency** — `CHECK (offer_package >= 0)`, `UNIQUE(student, drive)` and
  foreign keys are always satisfied.
* **Isolation** — `READ COMMITTED` plus row locks; a competing writer cannot
  both pass the same eligibility check.
* **Durability** — `InnoDB` commits to the redo log; committed applications
  survive a restart.

### 23. Why `READ COMMITTED` instead of the MySQL default `REPEATABLE READ`?

`REPEATABLE READ` holds read views for the whole transaction, which for a web
request with short write transactions adds gap locking. `READ COMMITTED` plus
explicit `SELECT … FOR UPDATE` on the one contended row is simpler to reason
about and avoids surprise gap locks. The trade-off is documented in
`config/settings.py`.

### 24. What is the difference between `FOR UPDATE` and `LOCK IN SHARE MODE`?

`FOR UPDATE` takes an exclusive lock: other writers must wait. `LOCK IN SHARE
MODE` (`FOR SHARE`) takes a shared lock that still allows other readers but
blocks writers. This project needs the exclusive form because it is about to
write.

### 25. Could two officers progressing two different applications deadlock?

They lock *different* application rows, so no. A deadlock needs two transactions
to acquire the same pair of locks in opposite order; the code never locks more
than one row per transaction, which is itself a deadlock-avoidance strategy.

---

## SQL technique

### 26. Give an example of a correlated subquery in the report.

Query 16 in `docs/SQL_QUERIES.md` finds students whose CGPA is above their **own**
department's average. The average subquery references `sp.department_id` from the
outer row, so it is re-evaluated per row — unlike a plain subquery, which is
evaluated once.

### 27. How did you find the latest status change per application?

A window function: `ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY
changed_at DESC, id DESC)` filtered to `rn = 1`. The alternative — a correlated
`MAX(changed_at)` join — is longer and fails to break ties on identical
timestamps, which is why the `id` tiebreaker is included.

### 28. Where do you use `GROUP BY … HAVING`?

Query 12 (students with two or more applications), query 10 (companies with at
least one offer) and every dashboard aggregation. `WHERE` filters rows before
grouping; `HAVING` filters after, which is required when the predicate uses
`COUNT()`.

### 29. What is the difference between `COUNT(*)` and `COUNT(column)`?

`COUNT(*)` counts rows; `COUNT(column)` counts non-NULL values. The statistics
use `COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN a.student_id END)`, where
the implicit `ELSE NULL` is essential — otherwise every applicant would be
counted as placed.

### 30. Show a use of `LEFT JOIN` that matters.

The department statistics: `departments LEFT JOIN student_profiles LEFT JOIN
applications`. A department with no applicants must still appear with a rate of
`0`, so an inner join would be wrong. The same pattern lists drives with no
applications (query 14).

### 31. Why `FIELD()` in one of the queries?

`FIELD(status, 'applied', …)` forces the funnel into pipeline order instead of
alphabetical order, so the chart reads like the process.

### 32. Why is there a `CHECK` constraint on `offer_package` and not on `cgpa`?

`cgpa` is bounded by validators in Django *and* by the column's type/precision in
MySQL; MySQL 8 supports `CHECK`, and the one place where a negative value would be
silently meaningless is `offer_package`, so it is expressed as a database
constraint: `CHECK (offer_package IS NULL OR offer_package >= 0)`. Others
(cross-column rules such as `package_max >= package_min`) are enforced in the
serializer because they need a custom error message per field.

---

## Design decisions & security

### 33. Why is eligibility computed on the server?

Because a client-side check is decoration, not a rule. `evaluate_eligibility` is
called by the catalogue, the standalone checker *and* `submit_application`
(inside the transaction). Even if a student crafts a raw HTTP request, an
ineligible application is rejected.

### 34. How do you prevent SQL injection?

The application never concatenates SQL. Django's ORM parameterises everything;
the raw statements in `docs/SQL_QUERIES.md` are documentation, and the migration
runner/SQL is generated. No user string ever reaches a query as SQL.

### 35. How are JWTs used and what is the trade-off of storing them in localStorage?

Login returns an access token (60 min) and a refresh token (1 day, rotated). The
SPA stores them in `localStorage`; the API is stateless and logout blacklists the
refresh token server-side so it cannot be replayed. The trade-off: `localStorage`
is readable by any script on the origin, so it is XSS-sensitive. The mitigation
is React's default output escaping plus a strict CSP in production; an
`HttpOnly`-cookie design would remove the XSS exposure at the cost of CSRF
handling. This is written up in `docs/ARCHITECTURE.md` rather than hidden.

### 36. You export student data to CSV. What could go wrong?

CSV formula injection: a cell beginning with `=`, `+`, `-`, `@`, tab, CR or LF
can be executed as a formula by Excel/LibreOffice. `reports/csv.py` prefixes such
cells with a single quote, sets `Cache-Control: no-store` so exported personal
data is not cached by intermediaries, and restricts the endpoints to admins.

---

## Bonus: likely follow-ups

* **Why a custom user model?** So `role` is a schema-level column
  (`users.role`) rather than a group membership inferred in code, and so the
  e-mail login field is native to the model.
* **Why is `internal_notes` not hidden by the client?** It is removed in the
  serializer for student requests, so the field never leaves the server.
* **How would you add a "placed package" report?** Add a view (query 29) or a
  materialised summary table refreshed by a scheduled command; the current
  aggregation is fast enough at campus scale.
* **Would triggers be appropriate here?** A trigger could maintain
  `application_status_history`, but it would hide business logic from the
  application and make the API's behaviour depend on the database. The project
  keeps the state machine in a service, inside an explicit transaction, and
  documents that choice.
