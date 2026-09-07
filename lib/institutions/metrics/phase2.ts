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

/** Map product workflow strings to a coarse assistance proxy. Not a validated taxonomy. */
export function workflowAssistanceProxy(raw: string): string {
  const key = raw.trim().toLowerCase()
  if (/grad|feedback|rubric/.test(key)) return "Assessment feedback"
  if (/flash|card/.test(key)) return "Flashcard generation"
  if (/search|rag|retriev/.test(key)) return "Search / retrieval"
  if (/document|vision|extract|pdf/.test(key)) return "Document analysis"
  if (/code|debug|playground/.test(key)) return "Code help"
  if (/quiz|practice|homework|question/.test(key)) return "Practice generation"
  if (/chat|tutor|agent|cora|ask/.test(key)) return "Conversation"
  if (/announce|analytics|dashboard/.test(key)) return "Faculty operations"
  return "Other"
}

export type ConceptAnalyticsRow = {
  topic: string
  studentsExposed: number
  attempts: number
  correct: number
  accuracy: number
  firstAttemptAccuracy: number | null
  eventualAccuracy: number | null
}

export type PracticeAnalytics = {
  sessions: number
  completedSessions: number
  abandonedSessions: number
  questionsAttempted: number
  firstAttemptAccuracy: number | null
  eventualAccuracy: number | null
  avgAttemptsPerQuestion: number | null
  retryRate: number | null
  sampleStudents: number
  sequences: InstitutionNamedCount[]
}

export type AssessmentAnalyticsExtra = {
  started: number
  completed: number
  completionRate: number | null
  avgScore: number | null
  medianScore: number | null
  distribution: InstitutionNamedCount[]
  byCourse: InstitutionNamedCount[]
}

export type CoraAssistanceAnalytics = {
  sessions: number
  studentUsers: number
  medianCredits: number | null
  toolCallRate: number | null
  medianLatencyMs: number | null
  assistanceProxy: InstitutionNamedCount[]
  byHour: InstitutionNamedCount[]
  byWeekday: InstitutionNamedCount[]
  proxyNote: string
}

export type AiOutcomeLinkage = {
  associationNote: string
  coraSessions: number
  followedByPractice24h: number
  followedByPractice7d: number
  followedByAssessment7d: number
  practiceFollow24hRate: number | null
  meanPracticeScoreAfter24h: number | null
  meanAssessmentScoreAfter7d: number | null
  noCoraMeanAssessmentScore: number | null
  intensityVsLaterScore: InstitutionNamedCount[]
  windowNs: { practice24h: number; practice7d: number; assessment7d: number; noCoraAssessments: number }
}

export async function getConceptAnalytics(scope: InstitutionScope): Promise<ConceptAnalyticsRow[]> {
  if (scope.courseIds.length === 0) return []
  const rows = await sql`
    WITH answers AS (
      SELECT
        st.id AS student_id,
        COALESCE(NULLIF(TRIM(qb.topic), ''), 'Untagged') AS topic,
        paa.bank_question_id,
        paa.is_correct,
        COALESCE(pa.completed_at, pa.started_at) AS ts
      FROM practice_answers paa
      JOIN practice_attempts pa ON pa.id = paa.attempt_id
      JOIN students st ON st.id = pa.student_id
      LEFT JOIN question_bank qb ON qb.id = paa.bank_question_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
        AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
    ),
    ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY student_id, bank_question_id ORDER BY ts ASC) AS rn,
        ROW_NUMBER() OVER (PARTITION BY student_id, bank_question_id ORDER BY ts DESC) AS rn_last
      FROM answers
      WHERE bank_question_id IS NOT NULL
    )
    SELECT
      topic,
      COUNT(DISTINCT student_id)::int AS students_exposed,
      COUNT(*)::int AS attempts,
      COUNT(*) FILTER (WHERE is_correct)::int AS correct,
      ROUND(AVG(CASE WHEN is_correct THEN 100.0 ELSE 0 END)::numeric, 1) AS accuracy,
      ROUND(AVG(CASE WHEN rn = 1 THEN CASE WHEN is_correct THEN 100.0 ELSE 0 END END)::numeric, 1) AS first_accuracy,
      ROUND(AVG(CASE WHEN rn_last = 1 THEN CASE WHEN is_correct THEN 100.0 ELSE 0 END END)::numeric, 1) AS eventual_accuracy
    FROM ranked
    GROUP BY topic
    HAVING COUNT(DISTINCT student_id) >= 1
    ORDER BY accuracy ASC, attempts DESC
    LIMIT 24
  `.catch(() => [])

  return rows.map((row) => ({
    topic: String(row.topic),
    studentsExposed: n(row, "students_exposed"),
    attempts: n(row, "attempts"),
    correct: n(row, "correct"),
    accuracy: Number(row.accuracy ?? 0),
    firstAttemptAccuracy: row.first_accuracy != null ? Number(row.first_accuracy) : null,
    eventualAccuracy: row.eventual_accuracy != null ? Number(row.eventual_accuracy) : null,
  }))
}

export async function getPracticeAnalytics(scope: InstitutionScope): Promise<PracticeAnalytics> {
  const empty: PracticeAnalytics = {
    sessions: 0,
    completedSessions: 0,
    abandonedSessions: 0,
    questionsAttempted: 0,
    firstAttemptAccuracy: null,
    eventualAccuracy: null,
    avgAttemptsPerQuestion: null,
    retryRate: null,
    sampleStudents: 0,
    sequences: [],
  }
  if (scope.courseIds.length === 0) return empty

  const [sessionRow, answerMeta, sequences] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(*) FILTER (WHERE pa.completed_at IS NOT NULL)::int AS completed,
        COUNT(*) FILTER (WHERE pa.completed_at IS NULL)::int AS abandoned,
        COUNT(DISTINCT pa.student_id)::int AS students
      FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
    `.catch(() => [{ sessions: 0, completed: 0, abandoned: 0, students: 0 }]),
    sql`
      WITH ranked AS (
        SELECT
          paa.bank_question_id,
          pa.student_id,
          paa.is_correct,
          ROW_NUMBER() OVER (PARTITION BY pa.student_id, paa.bank_question_id ORDER BY COALESCE(pa.completed_at, pa.started_at)) AS rn,
          ROW_NUMBER() OVER (PARTITION BY pa.student_id, paa.bank_question_id ORDER BY COALESCE(pa.completed_at, pa.started_at) DESC) AS rn_last,
          COUNT(*) OVER (PARTITION BY pa.student_id, paa.bank_question_id) AS n
        FROM practice_answers paa
        JOIN practice_attempts pa ON pa.id = paa.attempt_id
        JOIN students st ON st.id = pa.student_id
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
          AND COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
          AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
          AND paa.bank_question_id IS NOT NULL
      )
      SELECT
        COUNT(*)::int AS answers,
        ROUND(AVG(n)::numeric, 2) AS avg_attempts,
        ROUND(AVG(CASE WHEN rn = 1 THEN CASE WHEN is_correct THEN 100.0 ELSE 0 END END)::numeric, 1) AS first_acc,
        ROUND(AVG(CASE WHEN rn_last = 1 THEN CASE WHEN is_correct THEN 100.0 ELSE 0 END END)::numeric, 1) AS eventual_acc,
        ROUND(100.0 * COUNT(DISTINCT student_id || ':' || bank_question_id) FILTER (WHERE n >= 2)
          / NULLIF(COUNT(DISTINCT student_id || ':' || bank_question_id), 0), 1) AS retry_rate
      FROM ranked
    `.catch(() => [{ answers: 0, avg_attempts: null, first_acc: null, eventual_acc: null, retry_rate: null }]),
    sql`
      SELECT
        CASE
          WHEN pa.completed_at IS NULL THEN 'Started → abandoned'
          WHEN pa.score_percentage >= 70 THEN 'Completed → ≥70%'
          WHEN pa.score_percentage >= 50 THEN 'Completed → 50–69%'
          ELSE 'Completed → below 50%'
        END AS name,
        COUNT(*)::int AS value
      FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
      GROUP BY 1
      ORDER BY 2 DESC
    `.catch(() => []),
  ])

  const s = sessionRow[0] ?? {}
  const a = answerMeta[0] ?? {}
  return {
    sessions: n(s, "sessions"),
    completedSessions: n(s, "completed"),
    abandonedSessions: n(s, "abandoned"),
    questionsAttempted: n(a, "answers"),
    firstAttemptAccuracy: a.first_acc != null ? Number(a.first_acc) : null,
    eventualAccuracy: a.eventual_acc != null ? Number(a.eventual_acc) : null,
    avgAttemptsPerQuestion: a.avg_attempts != null ? Number(a.avg_attempts) : null,
    retryRate: a.retry_rate != null ? Number(a.retry_rate) : null,
    sampleStudents: n(s, "students"),
    sequences: named(sequences as Array<Record<string, unknown>>),
  }
}

export async function getAssessmentAnalyticsExtra(scope: InstitutionScope): Promise<AssessmentAnalyticsExtra> {
  const empty: AssessmentAnalyticsExtra = {
    started: 0,
    completed: 0,
    completionRate: null,
    avgScore: null,
    medianScore: null,
    distribution: [],
    byCourse: [],
  }
  if (scope.courseIds.length === 0) return empty

  const [summary, distribution, byCourse] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS started,
        COUNT(*) FILTER (WHERE qa.completed_at IS NOT NULL)::int AS completed,
        ROUND(AVG(qa.score::float) FILTER (WHERE qa.completed_at IS NOT NULL)::numeric, 1) AS avg_score,
        (
          SELECT ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY q2.score::float))::numeric, 1)
          FROM quiz_attempts q2
          JOIN students s2 ON s2.id = q2.student_id
          WHERE s2.course_id = ANY(${scope.courseIds}) AND s2.deleted_at IS NULL AND q2.deleted_at IS NULL
            AND q2.completed_at IS NOT NULL
            AND q2.completed_at::date >= ${scope.from}::date AND q2.completed_at::date <= ${scope.to}::date
        ) AS median_score
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL AND qa.deleted_at IS NULL
        AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
    `.catch(() => [{ started: 0, completed: 0, avg_score: null, median_score: null }]),
    sql`
      SELECT
        CASE
          WHEN qa.score < 60 THEN 'Below 60'
          WHEN qa.score < 70 THEN '60–69'
          WHEN qa.score < 80 THEN '70–79'
          WHEN qa.score < 90 THEN '80–89'
          ELSE '90–100'
        END AS name,
        COUNT(*)::int AS value
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      GROUP BY 1
    `.catch(() => []),
    sql`
      SELECT COALESCE(c.course_code, c.course_title, 'Course') AS name,
        ROUND(AVG(qa.score::float)::numeric, 1) AS value
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      JOIN courses c ON c.id = st.course_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      GROUP BY 1
      ORDER BY 2 ASC
    `.catch(() => []),
  ])

  const s = summary[0] ?? {}
  const started = n(s, "started")
  const completed = n(s, "completed")
  return {
    started,
    completed,
    completionRate: started > 0 ? Math.round((completed / started) * 1000) / 10 : null,
    avgScore: s.avg_score != null ? Number(s.avg_score) : null,
    medianScore: s.median_score != null ? Number(s.median_score) : null,
    distribution: named(distribution as Array<Record<string, unknown>>),
    byCourse: named(byCourse as Array<Record<string, unknown>>),
  }
}

export async function getCoraAssistanceAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<CoraAssistanceAnalytics> {
  const [totals, usage, events, hourly, weekday] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(DISTINCT user_id) FILTER (WHERE user_type = 'student')::int AS student_users,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY credits))::numeric, 1) AS median_credits
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `.catch(() => [{ sessions: 0, student_users: 0, median_credits: null }]),
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COALESCE(NULLIF(TRIM(workflow_type), ''), 'other') AS workflow
      FROM institution_cora_usage
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
      GROUP BY 2
    `.catch(() => []),
    sql`
      SELECT
        ROUND(100.0 * COUNT(*) FILTER (WHERE tool_calls_count > 0) / NULLIF(COUNT(*), 0), 1) AS tool_rate,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE latency_ms IS NOT NULL))::numeric, 0) AS median_latency
      FROM cora_usage_events
      WHERE institution_id = ${institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `.catch(() => [{ tool_rate: null, median_latency: null }]),
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
  ])

  const proxyMap = new Map<string, number>()
  const t = totals[0] ?? {}
  const sessions = n(t, "sessions")
  const studentUsers = n(t, "student_users")
  const medianCredits = t.median_credits != null ? Number(t.median_credits) : null
  for (const row of usage) {
    const label = workflowAssistanceProxy(String(row.workflow ?? "other"))
    proxyMap.set(label, (proxyMap.get(label) ?? 0) + n(row, "sessions"))
  }

  const ev = events[0] ?? {}
  return {
    sessions,
    studentUsers,
    medianCredits,
    toolCallRate: ev.tool_rate != null ? Number(ev.tool_rate) : null,
    medianLatencyMs: ev.median_latency != null ? Number(ev.median_latency) : null,
    assistanceProxy: [...proxyMap.entries()]
      .map(([name, value]) => ({ key: name, name, value }))
      .sort((a, b) => b.value - a.value),
    byHour: named(hourly as Array<Record<string, unknown>>),
    byWeekday: named(weekday as Array<Record<string, unknown>>),
    proxyNote:
      "Assistance types are a workflow-name proxy from institution_cora_usage, not a classified hint/explanation/solution taxonomy.",
  }
}

export async function getAiOutcomeLinkage(scope: InstitutionScope, institutionId: number): Promise<AiOutcomeLinkage> {
  const empty: AiOutcomeLinkage = {
    associationNote:
      "Descriptive association only. Students who use Cora may differ from those who do not. This is not an AI effect and not causal.",
    coraSessions: 0,
    followedByPractice24h: 0,
    followedByPractice7d: 0,
    followedByAssessment7d: 0,
    practiceFollow24hRate: null,
    meanPracticeScoreAfter24h: null,
    meanAssessmentScoreAfter7d: null,
    noCoraMeanAssessmentScore: null,
    intensityVsLaterScore: [],
    windowNs: { practice24h: 0, practice7d: 0, assessment7d: 0, noCoraAssessments: 0 },
  }
  if (scope.courseIds.length === 0) return empty

  const [link, intensity, control] = await Promise.all([
    sql`
      WITH cora AS (
        SELECT u.user_id, u.created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.deleted_at IS NULL AND st.course_id = ANY(${scope.courseIds})
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      ),
      next_practice AS (
        SELECT c.user_id, c.created_at AS cora_at, pa.score_percentage, pa.completed_at,
          ROW_NUMBER() OVER (PARTITION BY c.user_id, c.created_at ORDER BY pa.completed_at) AS rn
        FROM cora c
        JOIN practice_attempts pa ON pa.student_id = c.user_id AND pa.completed_at > c.created_at
          AND pa.completed_at <= c.created_at + INTERVAL '7 days'
      ),
      next_quiz AS (
        SELECT c.user_id, c.created_at AS cora_at, qa.score, qa.completed_at,
          ROW_NUMBER() OVER (PARTITION BY c.user_id, c.created_at ORDER BY qa.completed_at) AS rn
        FROM cora c
        JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL
          AND qa.completed_at > c.created_at AND qa.completed_at <= c.created_at + INTERVAL '7 days'
      )
      SELECT
        (SELECT COUNT(*) FROM cora)::int AS cora_sessions,
        (SELECT COUNT(*) FROM next_practice WHERE rn = 1 AND completed_at <= cora_at + INTERVAL '24 hours')::int AS p24,
        (SELECT COUNT(*) FROM next_practice WHERE rn = 1)::int AS p7,
        (SELECT COUNT(*) FROM next_quiz WHERE rn = 1)::int AS q7,
        (SELECT ROUND(AVG(score_percentage)::numeric, 1) FROM next_practice WHERE rn = 1 AND completed_at <= cora_at + INTERVAL '24 hours') AS p24_score,
        (SELECT ROUND(AVG(score)::numeric, 1) FROM next_quiz WHERE rn = 1) AS q7_score
    `.catch(() => []),
    sql`
      WITH cora_n AS (
        SELECT u.user_id, COUNT(*)::int AS sessions
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.deleted_at IS NULL AND st.course_id = ANY(${scope.courseIds})
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
        GROUP BY 1
      ),
      later AS (
        SELECT c.user_id, c.sessions, AVG(qa.score::float) AS score
        FROM cora_n c
        JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
          AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        GROUP BY c.user_id, c.sessions
      )
      SELECT
        CASE WHEN sessions = 1 THEN '1 Cora session' WHEN sessions <= 4 THEN '2–4 sessions' ELSE '5+ sessions' END AS name,
        COUNT(*)::int AS n,
        ROUND(AVG(score)::numeric, 1) AS value
      FROM later
      GROUP BY 1
    `.catch(() => []),
    sql`
      SELECT ROUND(AVG(qa.score::float)::numeric, 1) AS score, COUNT(DISTINCT st.id)::int AS n
      FROM students st
      JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM institution_cora_usage u
          WHERE u.institution_id = ${institutionId} AND u.user_type = 'student' AND u.user_id = st.id
            AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
        )
    `.catch(() => [{ score: null, n: 0 }]),
  ])

  const l = link[0] ?? {}
  const coraSessions = n(l, "cora_sessions")
  const p24 = n(l, "p24")
  const p7 = n(l, "p7")
  const q7 = n(l, "q7")
  const controlN = n(control[0], "n")

  const intensityVsLaterScore = (intensity as Array<Record<string, unknown>>)
    .filter((row) => n(row, "n") >= MIN_CELL_SIZE)
    .map((row) => ({
      key: String(row.name),
      name: `${row.name} (N=${row.n})`,
      value: Number(row.value ?? 0),
    }))

  return {
    associationNote: empty.associationNote,
    coraSessions,
    followedByPractice24h: p24,
    followedByPractice7d: p7,
    followedByAssessment7d: q7,
    practiceFollow24hRate: coraSessions > 0 ? Math.round((p24 / coraSessions) * 1000) / 10 : null,
    meanPracticeScoreAfter24h: l.p24_score != null ? Number(l.p24_score) : null,
    meanAssessmentScoreAfter7d: l.q7_score != null ? Number(l.q7_score) : null,
    noCoraMeanAssessmentScore:
      controlN >= MIN_CELL_SIZE && control[0]?.score != null ? Number(control[0].score) : null,
    intensityVsLaterScore,
    windowNs: {
      practice24h: p24,
      practice7d: p7,
      assessment7d: q7,
      noCoraAssessments: controlN,
    },
  }
}
