import { sql } from "@/lib/db"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export type HybridOverviewCounts = {
  source: "analytics_events" | "legacy"
  practiceAttempts: number
  assessmentsSubmitted: number
  aiAssistedStudents: number
  activeStudents: number
}

async function institutionEventCount(
  institutionId: number,
  from: string,
  to: string,
  courseIds: number[],
  eventTypes: string[],
): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM analytics_events
    WHERE institution_id = ${institutionId}
      AND event_type = ANY(${eventTypes})
      AND occurred_at::date >= ${from}::date AND occurred_at::date <= ${to}::date
      AND (${courseIds.length} = 0 OR course_id IS NULL OR course_id = ANY(${courseIds}))
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>
  return Number(rows[0]?.n ?? 0)
}

async function institutionDistinctStudents(
  institutionId: number,
  from: string,
  to: string,
  courseIds: number[],
  eventTypes: string[],
): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(DISTINCT user_id)::int AS n FROM analytics_events
    WHERE institution_id = ${institutionId}
      AND user_type = 'student'
      AND user_id IS NOT NULL
      AND event_type = ANY(${eventTypes})
      AND occurred_at::date >= ${from}::date AND occurred_at::date <= ${to}::date
      AND (${courseIds.length} = 0 OR course_id IS NULL OR course_id = ANY(${courseIds}))
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>
  return Number(rows[0]?.n ?? 0)
}

export async function analyticsEventStreamVolume(institutionId: number): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM analytics_events WHERE institution_id = ${institutionId}
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>
  return Number(rows[0]?.n ?? 0)
}

/** Prefer analytics_events when the institution has a non-trivial event stream. */
export async function getHybridOverviewCounts(scope: InstitutionScope): Promise<HybridOverviewCounts> {
  if (scope.courseIds.length === 0) {
    return { source: "legacy", practiceAttempts: 0, assessmentsSubmitted: 0, aiAssistedStudents: 0, activeStudents: 0 }
  }

  const streamN = await analyticsEventStreamVolume(scope.institutionId)
  const useEvents = streamN >= 25

  if (useEvents) {
    const [practiceAttempts, assessmentsSubmitted, aiAssistedStudents, activeStudents] = await Promise.all([
      institutionEventCount(scope.institutionId, scope.from, scope.to, scope.courseIds, [
        "practice_started",
        "practice_attempted",
        "practice_correct",
      ]),
      institutionEventCount(scope.institutionId, scope.from, scope.to, scope.courseIds, ["assessment_submitted"]),
      institutionDistinctStudents(scope.institutionId, scope.from, scope.to, scope.courseIds, [
        "cora_opened",
        "cora_message_sent",
        "cora_session_completed",
        "cora_tool_called",
      ]),
      institutionDistinctStudents(scope.institutionId, scope.from, scope.to, scope.courseIds, [
        "practice_started",
        "assessment_started",
        "assessment_submitted",
        "cora_opened",
        "cora_message_sent",
      ]),
    ])
    if (practiceAttempts + assessmentsSubmitted + aiAssistedStudents + activeStudents > 0) {
      return { source: "analytics_events", practiceAttempts, assessmentsSubmitted, aiAssistedStudents, activeStudents }
    }
  }

  const [practiceRows, assessmentRows, aiRows, activeRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS n FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds})
        AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
    `.catch(() => [{ n: 0 }]) as Promise<Array<{ n: number }>>,
    sql`
      SELECT COUNT(*)::int AS n FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
    `.catch(() => [{ n: 0 }]) as Promise<Array<{ n: number }>>,
    sql`
      SELECT COUNT(DISTINCT user_id)::int AS n FROM institution_cora_usage
      WHERE institution_id = ${scope.institutionId} AND user_type = 'student'
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `.catch(() => [{ n: 0 }]) as Promise<Array<{ n: number }>>,
    sql`
      WITH covered AS (
        SELECT st.id FROM students st
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      ),
      active AS (
        SELECT c.id FROM covered c
        JOIN quiz_attempts qa ON qa.student_id = c.id
        WHERE qa.deleted_at IS NULL
          AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
          AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
        UNION
        SELECT c.id FROM covered c
        JOIN practice_attempts pa ON pa.student_id = c.id
        WHERE COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
          AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
        UNION
        SELECT c.id FROM covered c
        JOIN institution_cora_usage u ON u.user_type = 'student' AND u.user_id = c.id
        WHERE u.institution_id = ${scope.institutionId}
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      )
      SELECT COUNT(DISTINCT a.id)::int AS n FROM active a
    `.catch(() => [{ n: 0 }]) as Promise<Array<{ n: number }>>,
  ])

  return {
    source: "legacy",
    practiceAttempts: Number(practiceRows[0]?.n ?? 0),
    assessmentsSubmitted: Number(assessmentRows[0]?.n ?? 0),
    aiAssistedStudents: Number(aiRows[0]?.n ?? 0),
    activeStudents: Number(activeRows[0]?.n ?? 0),
  }
}

export async function getInterventionOverviewKpis(
  scope: InstitutionScope,
  institutionId: number,
): Promise<{ delivered: number; responseRate: number | null }> {
  const rows = (await sql`
    SELECT
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
      COUNT(*) FILTER (WHERE engaged_at IS NOT NULL)::int AS engaged
    FROM institution_interventions
    WHERE institution_id = ${institutionId}
      AND triggered_at::date >= ${scope.from}::date AND triggered_at::date <= ${scope.to}::date
      AND (${scope.courseIds.length} = 0 OR course_id IS NULL OR course_id = ANY(${scope.courseIds}))
  `.catch(() => [{ delivered: 0, engaged: 0 }])) as Array<{ delivered: number; engaged: number }>

  const delivered = Number(rows[0]?.delivered ?? 0)
  const engaged = Number(rows[0]?.engaged ?? 0)
  const responseRate = delivered > 0 ? Math.round((engaged / delivered) * 1000) / 10 : null
  return { delivered, responseRate }
}
