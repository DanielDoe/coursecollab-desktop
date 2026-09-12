/**
 * SQL fragments for classroom assignment availability (Postgres).
 * Keep in sync across submission list, submit, and manage routes.
 */

export const CLASSROOM_SUBMISSION_EXPIRES_AT_SQL = `
  CASE
    WHEN due_at IS NOT NULL THEN due_at
    WHEN duration_hours IS NULL THEN NULL
    ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
  END
`

export const CLASSROOM_SUBMISSION_IS_ACTIVE_SQL = `
  CASE
    WHEN due_at IS NOT NULL THEN due_at > NOW()
    WHEN duration_hours IS NULL THEN false
    ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
  END
`

export const CLASSROOM_SUBMISSION_DEADLINE_SQL = `
  COALESCE(due_at, created_at + ((COALESCE(duration_hours, 168)) * INTERVAL '1 hour'))
`
