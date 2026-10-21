# Demo Guide — a five-minute script

Everything below was executed against the real stack (Django + MySQL 8 + Vite).
Numbers shown come from the seeded dataset: **24 students · 6 companies · 9
drives · 18 applications · 5 interviews · 10 notifications**.

---

## Before the audience arrives (5 minutes, once)

```powershell
# 1. MySQL running. If you use the project's local instance:
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe" --defaults-file="C:\Users\aryan\AppData\Local\Temp\opencode\mysql-data\my.ini"

# 2. Environment + schema
Copy-Item .env.example .env      # then fill DB_USER / DB_PASSWORD / DJANGO_SECRET_KEY
cd backend
..\.venv\Scripts\python.exe manage.py migrate
..\.venv\Scripts\python.exe manage.py seed_demo_data --password "LocalDemo@2026"

# 3. Two terminals
..\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000      # terminal A
cd ..\frontend ; npm install ; npm run dev                          # terminal B
```

Open **http://127.0.0.1:5173** and keep a third terminal ready for MySQL:

```powershell
$mysql = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe"
& $mysql -u placement -p -h 127.0.0.1 placement_management
```

Demo accounts (created locally, never committed):

| Role | Account | Notes |
|---|---|---|
| Placement officer | `officer@example.invalid` | full access, reports, audit trail |
| Student | `student01@example.invalid` … `student24@example.invalid` | `student01` has a strong CGPA |
| Recruiter | `recruiter.nexora@example.invalid` | authorised for *Nexora Systems* |

The password is whatever you passed to `--password` (e.g. `LocalDemo@2026`).

---

## 0:00 — The problem (20 s)

> "The placement cell tracks eligibility, applications and offers across
> departments. This portal keeps all of it in one normalised MySQL schema, with
> an API that enforces every rule server-side."

Show the login screen: three demo roles listed, brand panel explaining that
metrics are aggregations, not hard-coded numbers.

---

## 0:20 — Officer dashboard (45 s)

Sign in as `officer@example.invalid`.

* Point at the KPI rail: **24 students, 6 companies, 7 active drives, 18
  applications, 2 placed, placement rate, average package**.
* "Every one of these is a `COUNT`/`AVG` executed by MySQL. Refresh the page and
  the numbers come from the database again."
* Hover a KPI — it lifts. Click **Students** in the sidebar; note the active nav
  state, section hierarchy and breadcrumb in the top bar.

Prove it live:

```sql
SELECT COUNT(*) AS students FROM student_profiles;
SELECT COUNT(*) AS applications FROM applications;
SELECT ROUND(AVG(offer_package),2) AS avg_package
FROM applications WHERE status = 'selected' AND offer_package IS NOT NULL;
```

---

## 1:05 — The eligibility engine (45 s)

Sidebar → **Placement Drives** → **New drive**.

Fill in: title *Demo Drive*, role *Trainee*, company *Nexora Systems*, min CGPA
**9.00**, max backlogs **0**, deadline next week, tick the required skill
**Python**. Save as a **draft**.

> "A draft is invisible to students. Now I publish it — that is an
> officer-only transition."

Click **Publish**, then open the drive and press **Check eligibility**.

* A high-CGPA student shows *eligible*.
* Change the CGPA filter in the URL or pick a weaker student — the verdict turns
  red with a sentence: *"Minimum CGPA for this drive is 9.00; your CGPA is
  8.50."*

> "That verdict comes from the server, and the same function runs again when the
> student actually submits — so a drive that closes between page-render and click
> is still rejected."

---

## 1:50 — Student journey (60 s)

Sign out (top-right profile menu). Sign in as `student01@example.invalid`.

* **Dashboard** — eligible drives, applications in progress, upcoming interviews.
* **Open Drives** → filter → open a drive → **Check eligibility** → **Submit
  application**. A toast confirms it.
* **My Applications** → the new row is there with status **Applied**; press
  **History** to show the `'' → applied` trail.
* Try to apply again: the server refuses ("You have already applied"), and the
  database would refuse it too:

```sql
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'applications' AND constraint_type = 'UNIQUE';
```

* **My Skills** — add a skill; it feeds the eligibility engine.

---

## 2:50 — Recruiter journey (60 s)

Sign in as `recruiter.nexora@example.invalid`.

* **Dashboard** — scoped to Nexora only: drives, applicants, funnel, offers.
* **My Drives** → the drive just published is **not** visible unless it belongs
  to Nexora; the recruiter's own drives show with application counts.
* **Applicants** → open the student who just applied → **Advance** →
  move to **Shortlisted** with a reason → the applicant list updates.
* **Interviews** → **Schedule interview**: pick the drive, a round, the
  candidate and a time. The student is notified immediately.
* **Record outcome** → *passed*, add feedback.

Show that the trail is real:

```sql
SELECT h.from_status, h.to_status, h.changed_by_role, h.reason, h.changed_at
FROM application_status_history h
WHERE h.application_id = (SELECT MAX(id) FROM applications)
ORDER BY h.changed_at;
```

---

## 3:50 — Officer verification (45 s)

Sign in again as `officer@example.invalid`.

* **Application pipeline** — the application now shows **Shortlisted**; the funnel
  and recent-activity feed reflect it.
* **Reports & analytics** — department placement rates, company selection rates,
  funnel chart, drive summary, and the four CSV export buttons. Export *Students*
  and open it: the file is real, and any cell starting with `=` is quoted.
* **Audit trail** — filter by action `status_change`; every administrative action
  from this demo is listed with actor, entity and IP.

---

## 4:35 — The DBMS punchline (25 s)

Return to MySQL:

```sql
-- 1. The duplicate-application guarantee
SHOW INDEX FROM applications WHERE Key_name = 'uniq_student_drive_application';

-- 2. The transaction that a single click performs
SELECT a.status, a.status_changed_at, COUNT(h.id) AS history_rows
FROM applications a LEFT JOIN application_status_history h ON h.application_id = a.id
GROUP BY a.id, a.status, a.status_changed_at ORDER BY a.id DESC LIMIT 5;

-- 3. Index usage for the funnel
EXPLAIN SELECT status, COUNT(*) FROM applications GROUP BY status;
```

> "Every click you saw wrote a row inside a transaction, updated an append-only
> history, and produced an audit entry. The schema is in 3NF with 13 unique
> constraints, 19 foreign keys and 15 named indexes."

---

## If something goes wrong

| Symptom | Fix |
|---|---|
| Login fails for seeded accounts | Re-run `seed_demo_data --password "…"`; the password you pass now becomes the one for accounts it created. Use `--reset` to rebuild from scratch. |
| `2002 … Can't connect` on the API | MySQL is not running — start `mysqld` with the project `my.ini`. |
| Frontend calls fail with CORS | Make sure `DJANGO_CORS_ALLOWED_ORIGINS` in `.env` includes `http://127.0.0.1:5173`. |
| Charts look empty | The browser is not signed in, so `/analytics/` returned `401`. Sign in again. |
| Port already in use | `runserver 127.0.0.1:8001` and set `VITE_API_BASE_URL` accordingly. |

---

## Clean-up

```powershell
# Wipe and reseed the demo data (keeps the schema)
..\.venv\Scripts\python.exe manage.py seed_demo_data --password "LocalDemo@2026" --reset
```
