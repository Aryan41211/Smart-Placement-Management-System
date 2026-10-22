# SQL Query Catalogue

30 runnable MySQL 8 queries against the real schema, grouped by the technique
they demonstrate. Every table and column name matches
`docs/DATABASE_SCHEMA.md`.

Run them after `python manage.py migrate` and
`python manage.py seed_demo_data --password "…"`:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" `
    -u placement -p -h 127.0.0.1 placement_management
```

The application itself executes equivalent SQL through the Django ORM; these
statements are the raw forms used for the DBMS report, the viva and `EXPLAIN`
work.

---

## A. Joins

### 1. Eligible students for one drive (CGPA, backlogs, department)

Maps directly onto `placements/services.py::evaluate_eligibility`.

```sql
SELECT sp.roll_number,
       u.full_name,
       d.code            AS department,
       sp.cgpa,
       sp.active_backlogs
FROM student_profiles AS sp
JOIN users            AS u  ON u.id  = sp.user_id
JOIN departments      AS d  ON d.id  = sp.department_id
JOIN job_drives       AS jd ON jd.id = 1
WHERE sp.cgpa                >= jd.min_cgpa
  AND sp.active_backlogs     <= jd.max_active_backlogs
  AND sp.graduation_year BETWEEN jd.min_graduation_year AND jd.max_graduation_year
  AND (NOT EXISTS (SELECT 1 FROM job_drives_allowed_departments jdad
                   WHERE jdad.jobdrive_id = jd.id)
       OR EXISTS (SELECT 1 FROM job_drives_allowed_departments jdad
                  WHERE jdad.jobdrive_id = jd.id
                    AND jdad.department_id = sp.department_id))
ORDER BY sp.cgpa DESC;
```

### 2. Active drives with company and live application counts

`LEFT JOIN` + `GROUP BY` so a drive with no applications still appears.

```sql
SELECT jd.id,
       jd.title,
       c.name                              AS company,
       jd.status,
       jd.application_deadline,
       COUNT(a.id)                         AS applications
FROM job_drives   AS jd
JOIN companies    AS c ON c.id = jd.company_id
LEFT JOIN applications AS a ON a.job_drive_id = jd.id
WHERE jd.status = 'published'
  AND jd.application_deadline > NOW()
GROUP BY jd.id, jd.title, c.name, jd.status, jd.application_deadline
ORDER BY applications DESC, jd.application_deadline ASC;
```

### 3. Student directory with a placed / not-placed flag

```sql
SELECT sp.roll_number,
       u.full_name,
       u.email,
       d.code        AS department,
       sp.cgpa,
       COUNT(a.id)   AS application_count,
       CASE WHEN SUM(a.status = 'selected') > 0 THEN 'Placed' ELSE 'Unplaced' END AS placement
FROM student_profiles AS sp
JOIN users       AS u ON u.id = sp.user_id
JOIN departments AS d ON d.id = sp.department_id
LEFT JOIN applications AS a ON a.student_id = sp.id
GROUP BY sp.id, sp.roll_number, u.full_name, u.email, d.code, sp.cgpa
ORDER BY sp.roll_number;
```

### 4. Full application report (student → drive → company → status)

```sql
SELECT a.id                              AS application_id,
       sp.roll_number,
       u.full_name                       AS student,
       d.code                            AS department,
       sp.cgpa,
       c.name                            AS company,
       jd.title                          AS drive,
       jd.role_designation,
       a.status,
       a.applied_at,
       a.offer_package
FROM applications   AS a
JOIN student_profiles AS sp ON sp.id = a.student_id
JOIN users          AS u  ON u.id  = sp.user_id
JOIN departments    AS d  ON d.id  = sp.department_id
JOIN job_drives     AS jd ON jd.id = a.job_drive_id
JOIN companies      AS c  ON c.id  = jd.company_id
ORDER BY a.applied_at DESC;
```

### 5. Interview schedule with student, round and company

```sql
SELECT i.id,
       i.scheduled_at,
       i.mode,
       i.status,
       i.outcome,
       r.name            AS round_name,
       r.sequence        AS round_no,
       sp.roll_number,
       u.full_name       AS student,
       c.name            AS company,
       jd.title          AS drive
FROM interviews       AS i
JOIN applications     AS a  ON a.id  = i.application_id
JOIN student_profiles AS sp ON sp.id = a.student_id
JOIN users            AS u  ON u.id  = sp.user_id
JOIN interview_rounds AS r  ON r.id  = i.round_id
JOIN job_drives       AS jd ON jd.id = r.job_drive_id
JOIN companies        AS c  ON c.id  = jd.company_id
WHERE i.status = 'scheduled'
ORDER BY i.scheduled_at;
```

### 6. Drive requirements with skill names (junction traversal)

```sql
SELECT jd.title      AS drive,
       s.name        AS skill,
       s.category,
       jds.requirement_level,
       jds.min_proficiency
FROM job_drive_skills AS jds
JOIN job_drives AS jd ON jd.id = jds.job_drive_id
JOIN skills     AS s  ON s.id  = jds.skill_id
ORDER BY jd.title, jds.requirement_level DESC, s.name;
```

---

## B. Aggregation

### 7. Department-wise placement statistics

```sql
SELECT d.code                                        AS department,
       d.name,
       COUNT(DISTINCT sp.id)                         AS students,
       COUNT(DISTINCT a.student_id)                  AS applicants,
       COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN a.student_id END) AS placed,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN a.student_id END)
             / NULLIF(COUNT(DISTINCT sp.id), 0), 2)  AS placement_rate_pct
FROM departments AS d
LEFT JOIN student_profiles AS sp ON sp.department_id = d.id
LEFT JOIN applications     AS a  ON a.student_id     = sp.id
GROUP BY d.id, d.code, d.name
ORDER BY placement_rate_pct DESC;
```

### 8. Application funnel — how many applications sit in each stage

```sql
SELECT a.status,
       COUNT(*) AS applications
FROM applications AS a
GROUP BY a.status
ORDER BY FIELD(a.status,
               'applied','under_review','shortlisted','interview',
               'selected','rejected','not_selected','withdrawn');
```

`FIELD()` keeps the pipeline order instead of the alphabetical one.

### 9. Company-wise recruitment performance

```sql
SELECT c.name                                        AS company,
       c.industry,
       COUNT(DISTINCT jd.id)                         AS drives,
       COUNT(DISTINCT a.id)                          AS applicants,
       COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN a.id END) AS selected,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN a.id END)
             / NULLIF(COUNT(DISTINCT a.id), 0), 2)   AS selection_rate_pct
FROM companies    AS c
LEFT JOIN job_drives   AS jd ON jd.company_id = c.id
LEFT JOIN applications AS a  ON a.job_drive_id = jd.id
GROUP BY c.id, c.name, c.industry
ORDER BY selected DESC, applicants DESC;
```

### 10. Top recruiters by number of offers

```sql
SELECT c.name                       AS company,
       COUNT(a.id)                  AS offers
FROM applications AS a
JOIN job_drives   AS jd ON jd.id = a.job_drive_id
JOIN companies    AS c  ON c.id  = jd.company_id
WHERE a.status = 'selected'
GROUP BY c.id, c.name
HAVING COUNT(a.id) >= 1
ORDER BY offers DESC
LIMIT 5;
```

### 11. Package statistics for selected offers

```sql
SELECT COUNT(*)                AS offers,
       ROUND(AVG(offer_package), 2) AS average_package,
       MIN(offer_package)       AS lowest_package,
       MAX(offer_package)       AS highest_package,
       SUM(offer_package)       AS total_committed
FROM applications
WHERE status = 'selected'
  AND offer_package IS NOT NULL;
```

### 12. Students with the most applications (`HAVING`)

```sql
SELECT sp.roll_number,
       u.full_name,
       COUNT(a.id) AS applications
FROM applications     AS a
JOIN student_profiles AS sp ON sp.id = a.student_id
JOIN users            AS u  ON u.id  = sp.user_id
GROUP BY sp.id, sp.roll_number, u.full_name
HAVING COUNT(a.id) >= 2
ORDER BY applications DESC, sp.roll_number;
```

### 13. Placement rate by graduation year

```sql
SELECT sp.graduation_year,
       COUNT(*)                                            AS students,
       COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END) AS placed,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END)
             / NULLIF(COUNT(*), 0), 2)                     AS rate_pct
FROM student_profiles AS sp
LEFT JOIN applications AS a ON a.student_id = sp.id
GROUP BY sp.graduation_year
ORDER BY sp.graduation_year;
```

---

## C. Subqueries

### 14. Drives that have received no applications yet

```sql
SELECT jd.title, c.name AS company, jd.status, jd.application_deadline
FROM job_drives AS jd
JOIN companies  AS c ON c.id = jd.company_id
WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_drive_id = jd.id)
ORDER BY jd.application_deadline;
```

### 15. Students who applied but were never shortlisted

```sql
SELECT sp.roll_number, u.full_name, COUNT(a.id) AS applications
FROM applications     AS a
JOIN student_profiles AS sp ON sp.id = a.student_id
JOIN users            AS u  ON u.id  = sp.user_id
WHERE NOT EXISTS (
        SELECT 1 FROM applications x
        WHERE x.student_id = a.student_id
          AND x.status IN ('shortlisted','interview','selected'))
GROUP BY sp.id, sp.roll_number, u.full_name
ORDER BY applications DESC;
```

### 16. Students above their **own** department's average CGPA

Correlated subquery — the average is recomputed per row's department.

```sql
SELECT sp.roll_number,
       u.full_name,
       d.code  AS department,
       sp.cgpa,
       (SELECT ROUND(AVG(s2.cgpa), 2)
        FROM student_profiles s2
        WHERE s2.department_id = sp.department_id) AS department_avg,
       ROUND(sp.cgpa - (SELECT AVG(s2.cgpa)
                        FROM student_profiles s2
                        WHERE s2.department_id = sp.department_id), 2) AS delta
FROM student_profiles AS sp
JOIN users       AS u ON u.id = sp.user_id
JOIN departments AS d ON d.id = sp.department_id
WHERE sp.cgpa > (SELECT AVG(s2.cgpa)
                 FROM student_profiles s2
                 WHERE s2.department_id = sp.department_id)
ORDER BY delta DESC;
```

### 17. Skill gap — eligible students missing a *required* skill

```sql
SELECT jd.title AS drive, s.name AS missing_skill, COUNT(sp.id) AS students_missing
FROM job_drive_skills AS jds
JOIN job_drives       AS jd ON jd.id = jds.job_drive_id
JOIN skills           AS s  ON s.id  = jds.skill_id
JOIN student_profiles AS sp
     ON sp.cgpa >= COALESCE(jd.min_cgpa, 0)
WHERE jds.requirement_level = 'required'
  AND NOT EXISTS (SELECT 1 FROM student_skills ss
                  WHERE ss.student_id = sp.id
                    AND ss.skill_id   = jds.skill_id)
GROUP BY jd.title, s.name
ORDER BY students_missing DESC;
```

### 18. Interview count per application (scalar subquery in `SELECT`)

```sql
SELECT a.id,
       sp.roll_number,
       a.status,
       (SELECT COUNT(*) FROM interviews i WHERE i.application_id = a.id) AS interviews
FROM applications     AS a
JOIN student_profiles AS sp ON sp.id = a.student_id
ORDER BY interviews DESC, a.id
LIMIT 20;
```

---

## D. Window functions

### 19. Latest status change per application

```sql
SELECT application_id, from_status, to_status, changed_by_role, reason, changed_at
FROM (
    SELECT h.*,
           ROW_NUMBER() OVER (PARTITION BY h.application_id
                              ORDER BY h.changed_at DESC, h.id DESC) AS rn
    FROM application_status_history AS h
) AS ranked
WHERE rn = 1
ORDER BY changed_at DESC;
```

### 20. Rank departments by placement rate

```sql
SELECT d.code AS department,
       COUNT(DISTINCT sp.id) AS students,
       COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END) AS placed,
       RANK() OVER (ORDER BY COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END) DESC) AS dept_rank
FROM departments AS d
LEFT JOIN student_profiles AS sp ON sp.department_id = d.id
LEFT JOIN applications     AS a  ON a.student_id     = sp.id
GROUP BY d.id, d.code
ORDER BY dept_rank;
```

### 21. Days from application to shortlist, per candidate

```sql
SELECT sp.roll_number,
       jd.title,
       a.applied_at,
       a.shortlisted_at,
       TIMESTAMPDIFF(DAY, a.applied_at, a.shortlisted_at) AS days_to_shortlist
FROM applications     AS a
JOIN student_profiles AS sp ON sp.id = a.student_id
JOIN job_drives       AS jd ON jd.id = a.job_drive_id
WHERE a.shortlisted_at IS NOT NULL
ORDER BY days_to_shortlist;
```

---

## E. Operational queries

### 22. Unread notification badge per user

```sql
SELECT u.email,
       u.role,
       SUM(n.is_read = 0) AS unread,
       COUNT(n.id)        AS total
FROM users         AS u
LEFT JOIN notifications AS n ON n.recipient_id = u.id
GROUP BY u.id, u.email, u.role
ORDER BY unread DESC;
```

### 23. Audit trail for one entity

```sql
SELECT created_at, actor_email, action, description, ip_address
FROM audit_logs
WHERE entity_type = 'JobDrive'
  AND entity_id   = '1'
ORDER BY created_at DESC;
```

### 24. Admin activity in the last 7 days, grouped by action

```sql
SELECT action,
       COUNT(*)          AS events,
       COUNT(DISTINCT actor_email) AS distinct_actors,
       MAX(created_at)   AS last_seen
FROM audit_logs
WHERE created_at >= NOW() - INTERVAL 7 DAY
GROUP BY action
ORDER BY events DESC;
```

---

## F. Transactions, constraints and DDL

### 25. Submit an application — the exact transactional sequence

`applications/services.py::submit_application` performs this inside one
transaction. `SELECT … FOR UPDATE` takes an exclusive row lock on the drive so a
second request cannot slip past the deadline/duplicate checks.

```sql
START TRANSACTION;

-- 1. Lock the drive and re-read the current state.
SELECT id, status, application_deadline
FROM job_drives
WHERE id = 1
FOR UPDATE;

-- 2. Duplicate guard (the UNIQUE index is the real guarantee).
SELECT COUNT(*) FROM applications WHERE student_id = 7 AND job_drive_id = 1;

-- 3. Insert the application.
INSERT INTO applications
    (student_id, job_drive_id, status, applied_at, status_changed_at,
     resume_url, rejection_reason, internal_notes, eligibility_snapshot,
     created_at, updated_at)
VALUES
    (7, 1, 'applied', NOW(), NOW(), '', '', '',
     JSON_OBJECT('min_cgpa', 7.00, 'student_cgpa', 8.50), NOW(), NOW());

SET @new_id = LAST_INSERT_ID();

-- 4. Write the first history row in the same transaction.
INSERT INTO application_status_history
    (application_id, from_status, to_status, changed_by_id, changed_by_role, reason, changed_at)
VALUES (@new_id, '', 'applied', 7, 'student', 'Application submitted', NOW());

COMMIT;
```

### 26. A status transition — state change + trail + audit atomically

```sql
START TRANSACTION;

UPDATE applications
SET status = 'shortlisted',
    status_changed_at = NOW(),
    shortlisted_at    = NOW(),
    updated_at        = NOW()
WHERE id = 10
  AND status IN ('applied','under_review','shortlisted','interview');  -- guard

INSERT INTO application_status_history
    (application_id, from_status, to_status, changed_by_id, changed_by_role, reason, changed_at)
VALUES (10, 'under_review', 'shortlisted', 3, 'recruiter', 'Cleared the coding round', NOW());

INSERT INTO audit_logs
    (actor_id, actor_email, action, entity_type, entity_id, description, metadata, created_at)
VALUES (3, 'recruiter.nexora@example.invalid', 'status_change', 'Application', '10',
        'Application 10 moved from under_review to shortlisted',
        JSON_OBJECT('from_status','under_review','to_status','shortlisted'), NOW());

COMMIT;
```

### 27. The duplicate-application guarantee, demonstrated

```sql
-- Second insert for the same (student_id, job_drive_id) must fail:
INSERT INTO applications (student_id, job_drive_id, status, applied_at, rejection_reason,
                          internal_notes, eligibility_snapshot, resume_url)
VALUES (7, 1, 'applied', NOW(), '', '', JSON_OBJECT(), '');
-- ERROR 1062 (23000): Duplicate entry '7-1' for key 'uniq_student_drive_application'

-- The constraint itself:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'placement_management'
  AND table_name   = 'applications';
```

### 28. `EXPLAIN` — index usage for the dashboard funnel

```sql
EXPLAIN
SELECT status, COUNT(*)
FROM applications
WHERE applied_at >= NOW() - INTERVAL 30 DAY
GROUP BY status\G

EXPLAIN
SELECT COUNT(*)
FROM student_profiles
WHERE department_id = 1
  AND cgpa >= 7.00;
```

Both plans should show `ref`/`range` access on
`app_status_applied_idx`-style indexes rather than a full table scan.

### 29. Create a reporting view for the placement cell

```sql
CREATE OR REPLACE VIEW vw_placement_summary AS
SELECT d.code                       AS department,
       COUNT(DISTINCT sp.id)        AS students,
       COUNT(DISTINCT a.id)         AS applications,
       COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END) AS placed,
       ROUND(100.0 * COUNT(DISTINCT CASE WHEN a.status = 'selected' THEN sp.id END)
             / NULLIF(COUNT(DISTINCT sp.id), 0), 2) AS placement_rate_pct
FROM departments AS d
LEFT JOIN student_profiles AS sp ON sp.department_id = d.id
LEFT JOIN applications     AS a  ON a.student_id     = sp.id
GROUP BY d.id, d.code;

SELECT * FROM vw_placement_summary ORDER BY placement_rate_pct DESC;
```

### 30. Data-quality checks a viva examiner may ask for

```sql
-- (a) Any application not matching its drive's CGPA cut-off?  (should be empty)
SELECT a.id
FROM applications a
JOIN job_drives       jd ON jd.id = a.job_drive_id
JOIN student_profiles sp ON sp.id = a.student_id
WHERE jd.min_cgpa IS NOT NULL
  AND sp.cgpa < jd.min_cgpa;

-- (b) Any drive whose max package is below its min?  (should be empty)
SELECT id, package_min, package_max
FROM job_drives
WHERE package_max < package_min;

-- (c) Applications whose history has no opening row?  (should be empty)
SELECT a.id
FROM applications a
WHERE NOT EXISTS (SELECT 1 FROM application_status_history h
                  WHERE h.application_id = a.id AND h.from_status = '');

-- (d) Orphan check across the busiest FK.
SELECT COUNT(*) AS orphan_applications
FROM applications a
LEFT JOIN student_profiles sp ON sp.id = a.student_id
WHERE sp.id IS NULL;
```
