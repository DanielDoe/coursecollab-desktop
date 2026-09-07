import { sql } from "@/lib/db"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

function n(row: Record<string, unknown> | undefined, key: string): number {
  return Number(row?.[key] ?? 0)
}

function named(rows: Array<Record<string, unknown>>, nameKey = "name", valueKey = "value"): InstitutionNamedCount[] {
  return rows.map((row) => ({
    key: String(row[nameKey] ?? "other"),
    name: String(row[nameKey] ?? "Other"),
    value: Number(row[valueKey] ?? 0),
  }))
}

export type FeedbackAnalytics = {
  feedbackEvents: number
  automatedFeedback: number
  aiGeneratedFeedback: number
  instructorFeedback: number
  medianLatencySec: number | null
  feedbackViewed: number
  followedByRetry: number
  improvedAfterFeedback: number
  funnel: InstitutionNamedCount[]
  available: boolean
  note: string
}

export type AssistanceEscalation = {
  available: boolean
  note: string
  ladder: InstitutionNamedCount[]
  solvedWithoutAi: number | null
  solvedAfterHint: number | null
  solvedAfterExplanation: number | null
  requiredWorkedExample: number | null
  avgDepthBeforeSuccess: number | null
  escalationRate: number | null
  sampleN: number
}

export type TemporalAiPatterns = {
  byHour: InstitutionNamedCount[]
  byWeekday: InstitutionNamedCount[]
  byWeekOfTerm: InstitutionNamedCount[]
  deadlineProximity: InstitutionNamedCount[]
  note: string
}

export type AiRelianceMetrics = {
  note: string
  aiAssistedTaskShare: number | null
  interactionsPerSession: number | null
  medianAssistanceDepth: number | null
  independentAttemptRate: number | null
  attemptBeforeAiRate: number | null
  aiFirstInteractionRate: number | null
  hintToSolutionEscalationRate: number | null
  independentFollowThroughRate: number | null
  sampleN: number
}

export type ClassifiedAssistanceAnalytics = {
  available: boolean
  interactions: number
  byType: InstitutionNamedCount[]
  byDepth: InstitutionNamedCount[]
  medianConfidence: number | null
  note: string
}

export async function getFeedbackAnalytics(scope: InstitutionScope): Promise<FeedbackAnalytics> {
  const note =
    "Feedback funnel counts are descriptive. Improved after feedback uses a later higher score on the same assessment when available."
  if (scope.courseIds.length === 0) {
    return {
      feedbackEvents: 0,
      automatedFeedback: 0,
      aiGeneratedFeedback: 0,
      instructorFeedback: 0,
      medianLatencySec: null,
      feedbackViewed: 0,
      followedByRetry: 0,
      improvedAfterFeedback: 0,
      funnel: [],
      available: false,
      note,
    }
  }

  const [graded, auto, latency, retryRows, improvedRows, viewedRows] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS n
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN students st ON st.id = qat.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND qat.deleted_at IS NULL
        AND qa.score IS NOT NULL
        AND COALESCE(qat.completed_at, qat.started_at)::date >= ${scope.from}::date
        AND COALESCE(qat.completed_at, qat.started_at)::date <= ${scope.to}::date
    `.catch(() => [{ n: 0 }]),
    sql`
      SELECT COUNT(*)::int AS n
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN students st ON st.id = qat.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND qat.deleted_at IS NULL
        AND (qa.ai_feedback->>'aiGraded')::boolean IS TRUE
        AND COALESCE(qat.completed_at, qat.started_at)::date >= ${scope.from}::date
        AND COALESCE(qat.completed_at, qat.started_at)::date <= ${scope.to}::date
    `.catch(() => [{ n: 0 }]),
    sql`
      SELECT ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (qa.graded_at - qat.completed_at))
      ))::numeric, 0) AS median_sec
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN students st ON st.id = qat.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND qat.deleted_at IS NULL
        AND qa.graded_at IS NOT NULL AND qat.completed_at IS NOT NULL
        AND qat.completed_at::date >= ${scope.from}::date AND qat.completed_at::date <= ${scope.to}::date
    `.catch(() => [{ median_sec: null }]),
    scope.courseIds.length
      ? sql`
          SELECT COUNT(DISTINCT qa.student_id)::int AS n
          FROM quiz_attempts qa
          JOIN students st ON st.id = qa.student_id
          JOIN quizzes q ON q.id = qa.quiz_id
          WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL
            AND qa.attempt_number > 1
            AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        `.catch(() => [{ n: 0 }])
      : Promise.resolve([{ n: 0 }]),
    scope.courseIds.length
      ? sql`
          WITH scored AS (
            SELECT qa.student_id, qa.quiz_id, qa.score::float AS score,
              ROW_NUMBER() OVER (PARTITION BY qa.student_id, qa.quiz_id ORDER BY qa.completed_at ASC) AS rn
            FROM quiz_attempts qa
            JOIN students st ON st.id = qa.student_id
            WHERE st.course_id = ANY(${scope.courseIds}) AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
          )
          SELECT COUNT(*)::int AS n FROM scored a
          JOIN scored b ON a.student_id = b.student_id AND a.quiz_id = b.quiz_id AND b.rn = a.rn + 1
          WHERE b.score > a.score + 0.5
            AND a.rn = 1
        `.catch(() => [{ n: 0 }])
      : Promise.resolve([{ n: 0 }]),
    sql`
      SELECT COUNT(*)::int AS n FROM analytics_events
      WHERE institution_id = ${scope.institutionId}
        AND event_type = 'feedback_viewed'
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
        AND (${scope.courseIds.length} = 0 OR course_id IS NULL OR course_id = ANY(${scope.courseIds}))
    `.catch(() => [{ n: 0 }]),
  ])

  const feedbackEvents = n(graded[0], "n")
  const automatedFeedback = n(auto[0], "n")
  const aiGeneratedFeedback = automatedFeedback
  const instructorFeedback = Math.max(0, feedbackEvents - automatedFeedback)
  const medianLatencySec = latency[0]?.median_sec != null ? Number(latency[0].median_sec) : null
  const followedByRetry = n(retryRows[0], "n")
  const improvedAfterFeedback = n(improvedRows[0], "n")
  const viewedEvents = n(viewedRows[0], "n")
  const feedbackViewed = viewedEvents > 0 ? viewedEvents : Math.max(automatedFeedback, Math.round(feedbackEvents * 0.85))

  const funnel: InstitutionNamedCount[] = [
    { key: "events", name: "Feedback events", value: feedbackEvents },
    { key: "automated", name: "Automated / AI graded", value: automatedFeedback },
    { key: "viewed", name: viewedEvents > 0 ? "Viewed (instrumented)" : "Viewed (proxy)", value: feedbackViewed },
    { key: "retry", name: "Followed by retry attempt", value: followedByRetry },
    { key: "improved", name: "Improved score on retry", value: improvedAfterFeedback },
  ]

  return {
    feedbackEvents,
    automatedFeedback,
    aiGeneratedFeedback,
    instructorFeedback,
    medianLatencySec,
    feedbackViewed,
    followedByRetry,
    improvedAfterFeedback,
    funnel,
    available: feedbackEvents > 0,
    note,
  }
}

export async function getClassifiedAssistanceAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<ClassifiedAssistanceAnalytics> {
  const note =
    "Assistance types are inferred from workflow and message heuristics. Confidence reflects classifier certainty, not educational quality."
  const rows = await sql`
    SELECT assistance_type, assistance_depth, classification_confidence
    FROM ai_learning_interactions
    WHERE institution_id = ${institutionId}
      AND created_at::date >= ${scope.from}::date
      AND created_at::date <= ${scope.to}::date
  `.catch(() => [])

  const interactions = rows.length
  if (interactions === 0) {
    return { available: false, interactions: 0, byType: [], byDepth: [], medianConfidence: null, note }
  }

  const typeMap = new Map<string, number>()
  const depthMap = new Map<string, number>()
  const confidences: number[] = []
  for (const row of rows as Array<Record<string, unknown>>) {
    const t = String(row.assistance_type ?? "other").replace(/_/g, " ")
    typeMap.set(t, (typeMap.get(t) ?? 0) + 1)
    const d = `Level ${Number(row.assistance_depth ?? 0)}`
    depthMap.set(d, (depthMap.get(d) ?? 0) + 1)
    if (row.classification_confidence != null) confidences.push(Number(row.classification_confidence))
  }

  const sorted = [...confidences].sort((a, b) => a - b)
  const medianConfidence =
    sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)]! : null

  return {
    available: interactions >= MIN_CELL_SIZE,
    interactions,
    byType: [...typeMap.entries()]
      .map(([name, value]) => ({ key: name, name, value }))
      .sort((a, b) => b.value - a.value),
    byDepth: [...depthMap.entries()]
      .map(([name, value]) => ({ key: name, name, value }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    medianConfidence,
    note,
  }
}

export async function getAssistanceEscalation(
  scope: InstitutionScope,
  institutionId: number,
): Promise<AssistanceEscalation> {
  const note = "Ladder counts use inferred assistance depth before a correct practice attempt. Not a validated escalation model."
  const rows = await sql`
    SELECT assistance_depth, next_attempt_correct, attempt_count_before_ai
    FROM ai_learning_interactions
    WHERE institution_id = ${institutionId}
      AND created_at::date >= ${scope.from}::date
      AND created_at::date <= ${scope.to}::date
  `.catch(() => [])

  const sampleN = rows.length
  if (sampleN < MIN_CELL_SIZE) {
    return {
      available: false,
      note,
      ladder: [],
      solvedWithoutAi: null,
      solvedAfterHint: null,
      solvedAfterExplanation: null,
      requiredWorkedExample: null,
      avgDepthBeforeSuccess: null,
      escalationRate: null,
      sampleN,
    }
  }

  const ladderMap = new Map<string, number>([
    ["Independent success", 0],
    ["Hint success", 0],
    ["Guided reasoning success", 0],
    ["Worked example success", 0],
    ["Unresolved", 0],
  ])

  let depthSum = 0
  let successCount = 0
  let escalated = 0
  for (const row of rows as Array<Record<string, unknown>>) {
    const depth = Number(row.assistance_depth ?? 0)
    const correct = row.next_attempt_correct === true
    const before = Number(row.attempt_count_before_ai ?? 0)
    if (before > 0 && depth === 0) {
      ladderMap.set("Independent success", (ladderMap.get("Independent success") ?? 0) + (correct ? 1 : 0))
    } else if (depth <= 2) {
      ladderMap.set("Hint success", (ladderMap.get("Hint success") ?? 0) + (correct ? 1 : 0))
    } else if (depth === 3) {
      ladderMap.set("Guided reasoning success", (ladderMap.get("Guided reasoning success") ?? 0) + (correct ? 1 : 0))
    } else if (depth >= 4) {
      ladderMap.set("Worked example success", (ladderMap.get("Worked example success") ?? 0) + (correct ? 1 : 0))
    }
    if (!correct) ladderMap.set("Unresolved", (ladderMap.get("Unresolved") ?? 0) + 1)
    if (correct) {
      depthSum += depth
      successCount += 1
    }
    if (depth >= 4) escalated += 1
  }

  const ladder = [...ladderMap.entries()].map(([name, value]) => ({ key: name, name, value }))
  const total = Math.max(1, sampleN)
  return {
    available: true,
    note,
    ladder,
    solvedWithoutAi: Math.round(((ladderMap.get("Independent success") ?? 0) / total) * 1000) / 10,
    solvedAfterHint: Math.round(((ladderMap.get("Hint success") ?? 0) / total) * 1000) / 10,
    solvedAfterExplanation: Math.round(((ladderMap.get("Guided reasoning success") ?? 0) / total) * 1000) / 10,
    requiredWorkedExample: Math.round(((ladderMap.get("Worked example success") ?? 0) / total) * 1000) / 10,
    avgDepthBeforeSuccess: successCount > 0 ? Math.round((depthSum / successCount) * 10) / 10 : null,
    escalationRate: Math.round((escalated / total) * 1000) / 10,
    sampleN,
  }
}

export async function getTemporalAiPatterns(
  scope: InstitutionScope,
  institutionId: number,
): Promise<TemporalAiPatterns> {
  const note =
    "Deadline proximity joins Cora sessions to quiz due dates when available. Week-of-term uses license start as term anchor."
  const [hourly, weekday, proximity] = await Promise.all([
    sql`
      SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'HH24') || ':00' AS name, COUNT(*)::int AS value
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
      GROUP BY 1 ORDER BY 1
    `.catch(() => []),
    sql`
      SELECT TO_CHAR(created_at AT TIME ZONE 'UTC', 'Dy') AS name, COUNT(*)::int AS value
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
      GROUP BY 1
    `.catch(() => []),
    scope.courseIds.length
      ? sql`
          WITH sessions AS (
            SELECT u.created_at, q.due_date
            FROM institution_cora_usage u
            LEFT JOIN quizzes q ON q.course_id = u.course_id AND q.due_date IS NOT NULL
            WHERE u.institution_id = ${institutionId}
              AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
              AND (u.course_id IS NULL OR u.course_id = ANY(${scope.courseIds}))
          )
          SELECT
            CASE
              WHEN due_date IS NULL THEN 'No linked due date'
              WHEN created_at > due_date THEN 'After deadline'
              WHEN created_at >= due_date - INTERVAL '6 hours' THEN '<6 hours before'
              WHEN created_at >= due_date - INTERVAL '24 hours' THEN '6–24 hours before'
              WHEN created_at >= due_date - INTERVAL '3 days' THEN '1–3 days before'
              WHEN created_at >= due_date - INTERVAL '7 days' THEN '3–7 days before'
              ELSE '>7 days before'
            END AS name,
            COUNT(*)::int AS value
          FROM sessions
          GROUP BY 1
        `.catch(() => [])
      : Promise.resolve([]),
  ])

  const termStart = new Date(`${scope.from}T00:00:00Z`)
  const weekOfTerm = await sql`
    SELECT
      'Week ' || GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (created_at - ${termStart.toISOString()}::timestamptz)) / 604800) + 1)::int AS name,
      COUNT(*)::int AS value
    FROM institution_cora_usage
    WHERE institution_id = ${institutionId}
      AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    GROUP BY 1 ORDER BY 1
  `.catch(() => [])

  return {
    byHour: named(hourly as Array<Record<string, unknown>>),
    byWeekday: named(weekday as Array<Record<string, unknown>>),
    byWeekOfTerm: named(weekOfTerm as Array<Record<string, unknown>>),
    deadlineProximity: named(proximity as Array<Record<string, unknown>>),
    note,
  }
}

export async function getAiRelianceMetrics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<AiRelianceMetrics> {
  const note =
    "Transparent reliance indicators shown individually. No composite dependency score."
  if (scope.courseIds.length === 0) {
    return {
      note,
      aiAssistedTaskShare: null,
      interactionsPerSession: null,
      medianAssistanceDepth: null,
      independentAttemptRate: null,
      attemptBeforeAiRate: null,
      aiFirstInteractionRate: null,
      hintToSolutionEscalationRate: null,
      independentFollowThroughRate: null,
      sampleN: 0,
    }
  }

  const [students, coraStudents, interactions, practiceBefore] = await Promise.all([
    sql`SELECT COUNT(DISTINCT id)::int AS n FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL`,
    sql`
      SELECT COUNT(DISTINCT user_id)::int AS n FROM institution_cora_usage
      WHERE institution_id = ${institutionId} AND user_type = 'student'
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `,
    sql`
      SELECT
        COUNT(*)::int AS n,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY assistance_depth))::numeric, 1) AS median_depth,
        ROUND(100.0 * COUNT(*) FILTER (WHERE attempt_count_before_ai > 0) / NULLIF(COUNT(*), 0), 1) AS before_ai,
        ROUND(100.0 * COUNT(*) FILTER (WHERE COALESCE(attempt_count_before_ai, 0) = 0) / NULLIF(COUNT(*), 0), 1) AS ai_first,
        ROUND(100.0 * COUNT(*) FILTER (WHERE assistance_type = 'hint' AND assistance_depth >= 4) / NULLIF(COUNT(*) FILTER (WHERE assistance_type = 'hint'), 0), 1) AS hint_escalation,
        ROUND(100.0 * COUNT(*) FILTER (WHERE student_attempt_after_ai IS TRUE) / NULLIF(COUNT(*), 0), 1) AS follow_through
      FROM ai_learning_interactions
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `.catch(() => [{ n: 0, median_depth: null, before_ai: null, ai_first: null, hint_escalation: null, follow_through: null }]),
    sql`
      SELECT COUNT(DISTINCT pa.student_id)::int AS n FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds})
        AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
    `,
  ])

  const roster = n(students[0], "n")
  const coraN = n(coraStudents[0], "n")
  const ix = interactions[0] ?? {}
  const sampleN = n(ix, "n")
  const practiceN = n(practiceBefore[0], "n")

  return {
    note,
    aiAssistedTaskShare: roster > 0 ? Math.round((coraN / roster) * 1000) / 10 : null,
    interactionsPerSession: coraN > 0 && sampleN > 0 ? Math.round((sampleN / coraN) * 10) / 10 : null,
    medianAssistanceDepth: ix.median_depth != null ? Number(ix.median_depth) : null,
    independentAttemptRate: roster > 0 ? Math.round((practiceN / roster) * 1000) / 10 : null,
    attemptBeforeAiRate: ix.before_ai != null ? Number(ix.before_ai) : null,
    aiFirstInteractionRate: ix.ai_first != null ? Number(ix.ai_first) : null,
    hintToSolutionEscalationRate: ix.hint_escalation != null ? Number(ix.hint_escalation) : null,
    independentFollowThroughRate: ix.follow_through != null ? Number(ix.follow_through) : null,
    sampleN,
  }
}

export type AnalyticsFilterOptions = {
  courses: Array<{ id: number; code: string; name: string }>
  organizationUnits: Array<{ id: number; name: string }>
  instructors: Array<{ id: number; name: string }>
  sections: Array<{ id: number; label: string; courseId: number }>
}

export async function getAnalyticsFilterOptions(institutionId: number): Promise<AnalyticsFilterOptions> {
  const license = await sql`
    SELECT id FROM institution_licenses
    WHERE institution_id = ${institutionId} AND status = 'active'
    ORDER BY id DESC LIMIT 1
  `.catch(() => [])
  const licenseId = Number(license[0]?.id ?? 0)

  let courseIds: number[] = []
  if (licenseId > 0) {
    const scopeRows = await sql`
      SELECT DISTINCT course_id::int AS id FROM institution_license_scopes
      WHERE license_id = ${licenseId} AND course_id IS NOT NULL
    `
    courseIds = scopeRows.map((r) => Number(r.id)).filter((id) => id > 0)
  }
  if (courseIds.length === 0) {
    const instCourses = await sql`SELECT id::int AS id FROM courses WHERE university_id = ${institutionId}`
    courseIds = instCourses.map((r) => Number(r.id)).filter((id) => id > 0)
  }

  const [courses, orgUnits, instructors] = await Promise.all([
    courseIds.length
      ? sql`
          SELECT id::int AS id, course_code, course_title
          FROM courses WHERE id = ANY(${courseIds}) ORDER BY course_code
        `
      : Promise.resolve([]),
    licenseId > 0
      ? sql`
          SELECT DISTINCT ou.id::int AS id, ou.name
          FROM organization_units ou
          JOIN institution_license_scopes s ON s.organization_unit_id = ou.id
          WHERE s.license_id = ${licenseId}
          ORDER BY ou.name
        `
      : Promise.resolve([]),
    courseIds.length
      ? sql`
          SELECT DISTINCT i.id::int AS id, i.name
          FROM instructors i
          JOIN course_instructors ci ON ci.instructor_id = i.id
          WHERE ci.course_id = ANY(${courseIds})
          ORDER BY i.name
        `.catch(() => [])
      : Promise.resolve([]),
  ])

  return {
    courses: (courses as Array<Record<string, unknown>>).map((c) => ({
      id: Number(c.id),
      code: String(c.course_code ?? ""),
      name: String(c.course_title ?? c.course_code ?? ""),
    })),
    organizationUnits: (orgUnits as Array<Record<string, unknown>>).map((u) => ({
      id: Number(u.id),
      name: String(u.name ?? "Unit"),
    })),
    instructors: (instructors as Array<Record<string, unknown>>).map((i) => ({
      id: Number(i.id),
      name: String(i.name ?? "Instructor"),
    })),
    sections: [],
  }
}
