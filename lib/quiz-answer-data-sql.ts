/**
 * Safe SQL fragments for quiz_answers.answer_data — column may hold plain text or JSON strings.
 */

/** answer_data looks like JSON object/array (safe to cast to jsonb). */
export const ANSWER_DATA_LOOKS_JSON = `(qa.answer_data IS NOT NULL AND qa.answer_data ~ '^\\s*[\\{\\[]')`

/** Finalized when not draft autosave or already evaluated (all question types). */
export const ANY_ANSWER_FINALIZED_SQL = `(
  qa.answer_data IS NULL
  OR NOT ${ANSWER_DATA_LOOKS_JSON}
  OR ((qa.answer_data::jsonb)->>'autoSave') IS DISTINCT FROM 'true'
  OR ((qa.answer_data::jsonb)->>'evaluatedAt') IS NOT NULL
)`

/** Lockable MCQ/TF/select: finalized when not draft autosave or already evaluated. */
export const LOCKABLE_ANSWER_FINALIZED_SQL = ANY_ANSWER_FINALIZED_SQL

/** Circuit submission row counts as submitted/graded (not draft autosave). */
export const CIRCUIT_ANSWER_FINALIZED_SQL = `(
  (${ANSWER_DATA_LOOKS_JSON} AND ((qa.answer_data::jsonb)->>'evaluatedAt') IS NOT NULL)
  OR (
    qa.selected_answer IS NOT NULL
    AND qa.selected_answer ~ '^\\s*\\{'
    AND COALESCE((qa.selected_answer::jsonb)->>'submission_status', '') IN ('submitted', 'graded', 'returned')
  )
)`

/** answer_data has submissionFailed=true (column may be plain text — cast only when JSON-shaped). */
export const ANSWER_DATA_SUBMISSION_FAILED_SQL = `(
  ${ANSWER_DATA_LOOKS_JSON}
  AND (
    COALESCE((qa.answer_data::jsonb)->>'submissionFailed', '') IN ('true', 't', '1')
    OR ((qa.answer_data::jsonb)->'submissionFailed')::text = 'true'
  )
)`

/** Bare quiz_answers column (no table alias). */
export const ANSWER_DATA_SUBMISSION_FAILED_BARE_SQL = `(
  answer_data IS NOT NULL AND answer_data ~ '^\\s*[\\{\\[]'
  AND (
    COALESCE((answer_data::jsonb)->>'submissionFailed', '') IN ('true', 't', '1')
    OR ((answer_data::jsonb)->'submissionFailed')::text = 'true'
  )
)`

/** Row qualifies as a submission issue (manual review or failed network save). */
export const ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL = `(
  qa.requires_review = true
  OR (
    ${ANSWER_DATA_LOOKS_JSON}
    AND (
      COALESCE((qa.answer_data::jsonb)->>'submissionFailed', '') IN ('true', 't', '1')
      OR ((qa.answer_data::jsonb)->'submissionFailed')::text = 'true'
    )
  )
)`

/** Group-by label for submission diagnostics (cast answer_data only when JSON-shaped). */
export const ANSWER_SUBMISSION_ISSUE_ERROR_TYPE_SQL = `CASE
  WHEN ${ANSWER_DATA_LOOKS_JSON}
    AND (
      COALESCE((qa.answer_data::jsonb)->>'submissionFailed', '') IN ('true', 't', '1')
      OR ((qa.answer_data::jsonb)->'submissionFailed')::text = 'true'
    )
  THEN COALESCE((qa.answer_data::jsonb)->>'submission_error_type', 'Submission failed')
  WHEN qa.requires_review = true THEN 'Requires manual review'
  ELSE 'Unknown'
END`
