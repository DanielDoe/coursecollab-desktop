-- Scope faculty notifications to an owner.
--
-- `instructor_notifications` was created without an owner column, so every read of
-- the table returned every instructor's notifications to whoever asked. On the
-- desktop app that surfaced as OS notification-center banners for other faculty
-- members' student questions and submissions.
--
-- RUN THIS BEFORE DEPLOYING THE APP CHANGES.
-- lib/ensure-instructor-notification-ownership.ts adds the same columns and indexes
-- at runtime as a safety net, but it uses a plain (locking) CREATE INDEX. Running
-- this file first makes every statement there an IF NOT EXISTS no-op.
--
-- STEP 1 and STEP 3 are safe on live traffic. STEP 2 uses CONCURRENTLY and must NOT
-- run inside a transaction block — run it separately (psql, not a wrapped runner).

------------------------------------------------------------------------------
-- STEP 1 — columns. Instant: nullable, no default, no table rewrite.
------------------------------------------------------------------------------

ALTER TABLE instructor_notifications
  ADD COLUMN IF NOT EXISTS instructor_id INTEGER,
  ADD COLUMN IF NOT EXISTS course_id INTEGER;

------------------------------------------------------------------------------
-- STEP 2 — indexes. CONCURRENTLY so writes are never blocked.
-- Must run outside a transaction. If your runner wraps statements in BEGIN/COMMIT,
-- run these by hand, or drop CONCURRENTLY if the table is small.
------------------------------------------------------------------------------

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instructor_notifications_instructor
  ON instructor_notifications (instructor_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_instructor_notifications_course
  ON instructor_notifications (course_id, created_at DESC);

------------------------------------------------------------------------------
-- STEP 3 — backfill (STRONGLY RECOMMENDED).
--
-- Rows written before this migration carry no owner, and the scoped queries hide
-- unowned rows. Without a backfill, faculty notification lists appear empty after
-- deploy. Each statement below is guarded, so it is a no-op if the source table or
-- column does not exist in your schema.
------------------------------------------------------------------------------

-- 3a. Quiz-attempt notifications -> the quiz's course.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'quizzes' AND column_name = 'course_id') THEN
    UPDATE instructor_notifications n
       SET course_id = q.course_id
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
     WHERE n.course_id IS NULL
       AND n.instructor_id IS NULL
       AND n.source_type = 'quiz_attempt'
       AND n.source_id ~ '^[0-9]+$'
       AND qa.id = n.source_id::INTEGER;
  END IF;
END $$;

-- 3b. Course Exchange notifications -> the requesting instructor.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'course_exchange_requests'
               AND column_name = 'requester_instructor_id') THEN
    UPDATE instructor_notifications n
       SET instructor_id = r.requester_instructor_id
      FROM course_exchange_requests r
     WHERE n.instructor_id IS NULL
       AND n.source_type = 'course_exchange_request'
       AND n.source_id ~ '^[0-9]+$'
       AND r.id = n.source_id::INTEGER;
  END IF;
END $$;

-- 3c. Office-hour notifications -> the request's instructor, then its course.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'office_hour_requests' AND column_name = 'instructor_id') THEN
    UPDATE instructor_notifications n
       SET instructor_id = o.instructor_id
      FROM office_hour_requests o
     WHERE n.instructor_id IS NULL
       AND o.instructor_id IS NOT NULL
       AND n.source_type = 'office_hour'
       AND n.source_id ~ '^[0-9]+$'
       AND o.id = n.source_id::INTEGER;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'office_hour_requests' AND column_name = 'course_id') THEN
    UPDATE instructor_notifications n
       SET course_id = o.course_id
      FROM office_hour_requests o
     WHERE n.course_id IS NULL
       AND n.instructor_id IS NULL
       AND o.course_id IS NOT NULL
       AND n.source_type = 'office_hour'
       AND n.source_id ~ '^[0-9]+$'
       AND o.id = n.source_id::INTEGER;
  END IF;
END $$;

------------------------------------------------------------------------------
-- STEP 4 — check what is still unattributed, then decide.
------------------------------------------------------------------------------

-- SELECT type, source_type, COUNT(*) AS unowned
--   FROM instructor_notifications
--  WHERE instructor_id IS NULL AND course_id IS NULL
--  GROUP BY type, source_type
--  ORDER BY unowned DESC;

-- If this is effectively a single-instructor deployment, claim the remainder:
--
-- UPDATE instructor_notifications
--    SET instructor_id = <INSTRUCTOR_ID>
--  WHERE instructor_id IS NULL AND course_id IS NULL;
