import { sql } from "@/lib/db"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import { formatWeekLabel, parsePgDateOnly } from "@/lib/institutions/metrics/scope"
import { getStudentsNeedingAttention } from "@/lib/institutions/metrics/queries"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

const INDEPENDENT_POLICIES = ["AI_RESTRICTED", "AI_UNAVAILABLE", "INDEPENDENT_CHECK"]
const ASSISTED_POLICIES = ["AI_ALLOWED"]

const POLICY_LABELS: Record<string, string> = {
  AI_RESTRICTED: "AI restricted",
  AI_UNAVAILABLE: "AI unavailable",
  INDEPENDENT_CHECK: "Independent check",
  AI_ALLOWED: "AI allowed",
}

export function policyLabel(raw: string): string {
  const key = raw.trim().toUpperCase()
  return POLICY_LABELS[key] ?? raw.replace(/[_-]+/g, " ")
}

export type IndependentAnalytics = {
  taggedAssessments: number
  untaggedAssessments: number
  independentAttempts: number
  assistedAttempts: number
  independentScore: number | null
  assistedScore: number | null
  differencePp: number | null
  byPolicy: InstitutionNamedCount[]
  quadrants: InstitutionNamedCount[]
  scatterNote: string
  available: boolean
  unblock: string
}

export type TransferAnalytics = {
  available: boolean
  transferN: number
  transferScore: number | null
  delayedN: number
  delayedScore: number | null
  noPriorCoraIndependentScore: number | null
  associationNote: string
  unblock: string
}

export type InterventionAnalytics = {
  available: boolean
  eligible: number
  triggered: number
  delivered: number
  viewed: number
  engaged: number
  completed: number
  deliveryRate: number | null
  engagementRate: number | null
  completionRate: number | null
  funnel: InstitutionNamedCount[]
  unblock: string
}

export type TrajectoryWeek = {
  week: string
  label: string
  notAttempted: number
  emerging: number
  developing: number
  proficient: number
  mastered: number
}

export type BehavioralIndicators = {
  note: string
  studentsWithPracticeAndCora: number
  attemptBeforeAiRate: number | null
  aiFirstRate: number | null
  followThrough24hRate: number | null
  medianHoursPracticeToCora: number | null
  patterns: InstitutionNamedCount[]
  windowN: number
}

function num(row: Record<string, unknown> | undefined, key: string): number {
  return Number(row?.[key] ?? 0)
}

export async function getIndependentAnalytics(scope: InstitutionScope): Promise<IndependentAnalytics> {
  const unblock =
    "To enable this metric, tag assessments as AI_RESTRICTED, AI_UNAVAILABLE, or INDEPENDENT_CHECK and collect at least two linked observations per learner."
  const scatterNote =
    "Quadrants compare each student’s mean AI-allowed score to their mean independent-check score. Labels are descriptive, not a dependency diagnosis."
  if (scope.courseIds.length === 0) {
    return {
      taggedAssessments: 0,
      untaggedAssessments: 0,
      independentAttempts: 0,
      assistedAttempts: 0,
      independentScore: null,
      assistedScore: null,
      differencePp: null,
      byPolicy: [],
      quadrants: [],
      scatterNote,
      available: false,
      unblock,
    }
  }

  const [coverage, scores, quadrants] = await Promise.all([
    sql`
      SELECT
        COUNT(*) FILTER (WHERE q.ai_policy IS NOT NULL AND TRIM(q.ai_policy) <> '')::int AS tagged,
        COUNT(*) FILTER (WHERE q.ai_policy IS NULL OR TRIM(q.ai_policy) = '')::int AS untagged
      FROM quizzes q
      WHERE q.course_id = ANY(${scope.courseIds}) AND q.deleted_at IS NULL
    `.catch(() => [{ tagged: 0, untagged: 0 }]),
    sql`
      SELECT
        UPPER(TRIM(q.ai_policy)) AS policy,
        COUNT(*)::int AS attempts,
        ROUND(AVG(qa.score::float)::numeric, 1) AS score
      FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        AND q.ai_policy IS NOT NULL AND TRIM(q.ai_policy) <> ''
      GROUP BY 1
    `.catch(() => []),
    sql`
      WITH per_student AS (
        SELECT
          qa.student_id,
          AVG(qa.score::float) FILTER (WHERE UPPER(TRIM(q.ai_policy)) = ANY(${ASSISTED_POLICIES})) AS assisted,
          AVG(qa.score::float) FILTER (WHERE UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})) AS independent
        FROM quiz_attempts qa
        JOIN quizzes q ON q.id = qa.quiz_id
        JOIN students st ON st.id = qa.student_id
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        GROUP BY 1
        HAVING AVG(qa.score::float) FILTER (WHERE UPPER(TRIM(q.ai_policy)) = ANY(${ASSISTED_POLICIES})) IS NOT NULL
           AND AVG(qa.score::float) FILTER (WHERE UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})) IS NOT NULL
      )
      SELECT
        CASE
          WHEN assisted >= 70 AND independent >= 70 THEN 'High assisted / high independent'
          WHEN assisted >= 70 AND independent < 70 THEN 'High assisted / lower independent'
          WHEN assisted < 70 AND independent >= 70 THEN 'Lower assisted / high independent'
          ELSE 'Lower assisted / lower independent'
        END AS name,
        COUNT(*)::int AS value
      FROM per_student
      GROUP BY 1
    `.catch(() => []),
  ])

  const tagged = num(coverage[0], "tagged")
  const byPolicy = (scores as Array<Record<string, unknown>>).map((row) => ({
    key: String(row.policy),
    name: policyLabel(String(row.policy ?? "")),
    value: Number(row.score ?? 0),
    credits: Number(row.attempts ?? 0),
  }))
  const independentRows = (scores as Array<Record<string, unknown>>).filter((row) =>
    INDEPENDENT_POLICIES.includes(String(row.policy ?? "")),
  )
  const assistedRows = (scores as Array<Record<string, unknown>>).filter((row) =>
    ASSISTED_POLICIES.includes(String(row.policy ?? "")),
  )
  const independentAttempts = independentRows.reduce((s, r) => s + Number(r.attempts ?? 0), 0)
  const assistedAttempts = assistedRows.reduce((s, r) => s + Number(r.attempts ?? 0), 0)
  const independentScore =
    independentAttempts > 0
      ? Math.round(
          (independentRows.reduce((s, r) => s + Number(r.score ?? 0) * Number(r.attempts ?? 0), 0) / independentAttempts) * 10,
        ) / 10
      : null
  const assistedScore =
    assistedAttempts > 0
      ? Math.round((assistedRows.reduce((s, r) => s + Number(r.score ?? 0) * Number(r.attempts ?? 0), 0) / assistedAttempts) * 10) /
        10
      : null

  const quadrantRows = (quadrants as Array<Record<string, unknown>>).map((row) => ({
    key: String(row.name),
    name: String(row.name),
    value: Number(row.value ?? 0),
  }))
  const quadrantN = quadrantRows.reduce((s, r) => s + r.value, 0)

  return {
    taggedAssessments: tagged,
    untaggedAssessments: num(coverage[0], "untagged"),
    independentAttempts,
    assistedAttempts,
    independentScore,
    assistedScore,
    differencePp:
      independentScore != null && assistedScore != null ? Math.round((assistedScore - independentScore) * 10) / 10 : null,
    byPolicy,
    quadrants: quadrantN >= MIN_CELL_SIZE ? quadrantRows : [],
    scatterNote,
    available: tagged > 0 && independentAttempts > 0,
    unblock,
  }
}

export async function getTransferAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<TransferAnalytics> {
  const associationNote =
    "Transfer is the next independent-tagged assessment after a Cora session. Descriptive only — not an AI effect."
  const unblock =
    "Tag later assessments as independent and collect a Cora session plus a subsequent independent attempt for the same learner."
  if (scope.courseIds.length === 0) {
    return {
      available: false,
      transferN: 0,
      transferScore: null,
      delayedN: 0,
      delayedScore: null,
      noPriorCoraIndependentScore: null,
      associationNote,
      unblock,
    }
  }

  const [transfer, delayed, control] = await Promise.all([
    sql`
      WITH cora AS (
        SELECT u.user_id, u.created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      ),
      next_ind AS (
        SELECT qa.score, qa.completed_at, c.created_at,
          ROW_NUMBER() OVER (PARTITION BY c.user_id, c.created_at ORDER BY qa.completed_at) AS rn
        FROM cora c
        JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL AND qa.completed_at > c.created_at
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})
          AND qa.completed_at <= c.created_at + INTERVAL '14 days'
      )
      SELECT COUNT(*) FILTER (WHERE rn = 1)::int AS n,
        ROUND(AVG(score) FILTER (WHERE rn = 1)::numeric, 1) AS score
      FROM next_ind
    `.catch(() => [{ n: 0, score: null }]),
    sql`
      WITH cora AS (
        SELECT u.user_id, MAX(u.created_at) AS created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        GROUP BY 1
      )
      SELECT COUNT(*)::int AS n, ROUND(AVG(qa.score::float)::numeric, 1) AS score
      FROM cora c
      JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL
        AND qa.completed_at > c.created_at + INTERVAL '14 days'
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})
        AND q.course_id = ANY(${scope.courseIds})
    `.catch(() => [{ n: 0, score: null }]),
    sql`
      SELECT COUNT(DISTINCT st.id)::int AS n, ROUND(AVG(qa.score::float)::numeric, 1) AS score
      FROM students st
      JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        AND NOT EXISTS (
          SELECT 1 FROM institution_cora_usage u
          WHERE u.institution_id = ${institutionId} AND u.user_type = 'student' AND u.user_id = st.id
            AND u.created_at < qa.completed_at
        )
    `.catch(() => [{ n: 0, score: null }]),
  ])

  const transferN = num(transfer[0], "n")
  const delayedN = num(delayed[0], "n")
  const controlN = num(control[0], "n")
  return {
    available: transferN >= 2,
    transferN,
    transferScore: transfer[0]?.score != null ? Number(transfer[0].score) : null,
    delayedN,
    delayedScore: delayed[0]?.score != null ? Number(delayed[0].score) : null,
    noPriorCoraIndependentScore:
      controlN >= MIN_CELL_SIZE && control[0]?.score != null ? Number(control[0].score) : null,
    associationNote,
    unblock,
  }
}

export async function getInterventionAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<InterventionAnalytics> {
  const unblock =
    "Create intervention records (trigger → delivered → viewed → engaged → completed) before this funnel can be computed."
  const [rows, flagged] = await Promise.all([
    sql`
    SELECT
      COUNT(*)::int AS triggered,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL)::int AS delivered,
      COUNT(*) FILTER (WHERE viewed_at IS NOT NULL)::int AS viewed,
      COUNT(*) FILTER (WHERE engaged_at IS NOT NULL)::int AS engaged,
      COUNT(*) FILTER (WHERE completed_at IS NOT NULL)::int AS completed
    FROM institution_interventions
    WHERE institution_id = ${institutionId}
      AND triggered_at::date >= ${scope.from}::date AND triggered_at::date <= ${scope.to}::date
      AND (${scope.courseIds.length} = 0 OR course_id IS NULL OR course_id = ANY(${scope.courseIds}))
  `.catch(() => [{ triggered: 0, delivered: 0, viewed: 0, engaged: 0, completed: 0 }]),
    getStudentsNeedingAttention(scope, 200).catch(() => []),
  ])

  const r = rows[0] ?? {}
  const triggered = num(r, "triggered")
  const delivered = num(r, "delivered")
  const viewed = num(r, "viewed")
  const engaged = num(r, "engaged")
  const completed = num(r, "completed")
  const eligible = flagged.length
  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null)

  return {
    available: triggered > 0 || eligible > 0,
    eligible,
    triggered,
    delivered,
    viewed,
    engaged,
    completed,
    deliveryRate: rate(delivered, triggered),
    engagementRate: rate(engaged, delivered),
    completionRate: rate(completed, triggered),
    funnel: [
      { key: "triggered", name: "Triggered", value: triggered },
      { key: "delivered", name: "Delivered", value: delivered },
      { key: "viewed", name: "Viewed", value: viewed },
      { key: "engaged", name: "Engaged", value: engaged },
      { key: "completed", name: "Completed", value: completed },
    ],
    unblock,
  }
}

export async function getLearningTrajectories(scope: InstitutionScope): Promise<TrajectoryWeek[]> {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    WITH weeks AS (
      SELECT gs::date AS week
      FROM generate_series(date_trunc('week', ${scope.from}::date), date_trunc('week', ${scope.to}::date), INTERVAL '1 week') gs
    ),
    roster AS (
      SELECT id FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL
    ),
    weekly AS (
      SELECT date_trunc('week', COALESCE(pa.completed_at, pa.started_at))::date AS week,
        pa.student_id,
        AVG(pa.score_percentage::float) AS acc
      FROM practice_attempts pa
      JOIN roster r ON r.id = pa.student_id
      WHERE COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
        AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
      GROUP BY 1, 2
    )
    SELECT
      w.week,
      COUNT(*) FILTER (WHERE y.acc IS NULL)::int AS not_attempted,
      COUNT(*) FILTER (WHERE y.acc < 40)::int AS emerging,
      COUNT(*) FILTER (WHERE y.acc >= 40 AND y.acc < 60)::int AS developing,
      COUNT(*) FILTER (WHERE y.acc >= 60 AND y.acc < 80)::int AS proficient,
      COUNT(*) FILTER (WHERE y.acc >= 80)::int AS mastered
    FROM weeks w
    CROSS JOIN roster r
    LEFT JOIN weekly y ON y.week = w.week AND y.student_id = r.id
    GROUP BY w.week
    ORDER BY w.week
  `.catch(() => [])

  return rows.map((row) => {
    const week = parsePgDateOnly(row.week)
    return {
      week,
      label: formatWeekLabel(week),
      notAttempted: num(row, "not_attempted"),
      emerging: num(row, "emerging"),
      developing: num(row, "developing"),
      proficient: num(row, "proficient"),
      mastered: num(row, "mastered"),
    }
  })
}

export async function getBehavioralIndicators(
  scope: InstitutionScope,
  institutionId: number,
): Promise<BehavioralIndicators> {
  const note =
    "These are behavioral patterns from timestamps, not measures of cognition, self-regulation, or AI dependence."
  if (scope.courseIds.length === 0) {
    return {
      note,
      studentsWithPracticeAndCora: 0,
      attemptBeforeAiRate: null,
      aiFirstRate: null,
      followThrough24hRate: null,
      medianHoursPracticeToCora: null,
      patterns: [],
      windowN: 0,
    }
  }

  const [core, hours] = await Promise.all([
    sql`
      WITH cora AS (
        SELECT u.user_id, u.created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      )
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM practice_attempts pa
            WHERE pa.student_id = c.user_id
              AND COALESCE(pa.completed_at, pa.started_at) < c.created_at
              AND COALESCE(pa.completed_at, pa.started_at) >= c.created_at - INTERVAL '24 hours'
          )
        )::int AS attempt_before,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM practice_attempts pa
            WHERE pa.student_id = c.user_id
              AND COALESCE(pa.completed_at, pa.started_at) < c.created_at
              AND COALESCE(pa.completed_at, pa.started_at) >= c.created_at - INTERVAL '7 days'
          )
        )::int AS ai_first,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM practice_attempts pa
            WHERE pa.student_id = c.user_id AND pa.completed_at > c.created_at
              AND pa.completed_at <= c.created_at + INTERVAL '24 hours'
          )
        )::int AS follow_24h,
        COUNT(DISTINCT user_id)::int AS students
      FROM cora c
    `.catch(() => [{ sessions: 0, attempt_before: 0, ai_first: 0, follow_24h: 0, students: 0 }]),
    sql`
      WITH firsts AS (
        SELECT st.id AS student_id,
          MIN(COALESCE(pa.completed_at, pa.started_at)) AS first_practice,
          MIN(u.created_at) AS first_cora
        FROM students st
        JOIN practice_attempts pa ON pa.student_id = st.id
        JOIN institution_cora_usage u ON u.user_type = 'student' AND u.user_id = st.id
          AND u.institution_id = ${institutionId}
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        GROUP BY st.id
        HAVING MIN(u.created_at) IS NOT NULL AND MIN(COALESCE(pa.completed_at, pa.started_at)) IS NOT NULL
      )
      SELECT ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (first_cora - first_practice)) / 3600.0
      ))::numeric, 1) AS median_hours
      FROM firsts
      WHERE first_cora >= first_practice
    `.catch(() => [{ median_hours: null }]),
  ])

  const c = core[0] ?? {}
  const sessions = num(c, "sessions")
  const pct = (part: number) => (sessions > 0 ? Math.round((part / sessions) * 1000) / 10 : null)
  const attemptBefore = num(c, "attempt_before")
  const aiFirst = num(c, "ai_first")
  const follow = num(c, "follow_24h")

  return {
    note,
    studentsWithPracticeAndCora: num(c, "students"),
    attemptBeforeAiRate: pct(attemptBefore),
    aiFirstRate: pct(aiFirst),
    followThrough24hRate: pct(follow),
    medianHoursPracticeToCora: hours[0]?.median_hours != null ? Number(hours[0].median_hours) : null,
    windowN: sessions,
    patterns: [
      { key: "attempt_before", name: "Attempt before AI (24h)", value: attemptBefore },
      { key: "ai_first", name: "AI first (no practice in 7d)", value: aiFirst },
      { key: "follow_24h", name: "Practice after AI (24h)", value: follow },
    ],
  }
}
