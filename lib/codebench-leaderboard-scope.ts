/**
 * CodeBench leaderboard peers for the caller's academic term.
 * Catalog courses and section codes (ELEG1301P01) are reused each term, so a
 * course_id or section-text match alone includes the previous term.
 */
export function codebenchLeaderboardTermPredicateSql(
  academicTermId: number | null,
  studentAlias = "s",
): string {
  const alias = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(studentAlias) ? studentAlias : "s"
  const termId =
    academicTermId != null && Number.isFinite(academicTermId) && academicTermId > 0
      ? Math.trunc(academicTermId)
      : null
  const alive = `${alias}.deleted_at IS NULL`
  if (termId == null) return alive
  return `(
    ${alive}
    AND EXISTS (
      SELECT 1 FROM sessions peer_term
      WHERE peer_term.id = ${alias}.session_id
        AND peer_term.academic_term_id = ${termId}
    )
  )`
}
