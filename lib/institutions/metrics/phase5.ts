import { sql } from "@/lib/db"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import { formatWeekLabel, parsePgDateOnly } from "@/lib/institutions/metrics/scope"
import { researchStudentId } from "@/lib/institutions/research/research-ids"
import { toCsv } from "@/lib/institutions/research/stats"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

const INDEPENDENT_POLICIES = ["AI_RESTRICTED", "AI_UNAVAILABLE", "INDEPENDENT_CHECK"]

export const TRANSFER_WINDOWS = [
  { key: "d0_7", label: "0–7 days", minDays: 0, maxDays: 7 },
  { key: "d8_14", label: "8–14 days", minDays: 8, maxDays: 14 },
  { key: "d15_28", label: "15–28 days", minDays: 15, maxDays: 28 },
  { key: "d29_60", label: "29–60 days", minDays: 29, maxDays: 60 },
] as const

export type LatencyWindow = {
  key: string
  label: string
  n: number
  score: number | null
  insufficient: boolean
}

export type DelayedTransferAnalytics = {
  transferWindows: LatencyWindow[]
  subsequentWindows: LatencyWindow[]
  subsequentNote: string
  transferNote: string
  unblock: string
}

export type LongitudinalWeek = {
  week: string
  label: string
  studentsActive: number
  meanPractice: number | null
  meanAssessment: number | null
}

export type LongitudinalAnalytics = {
  rosterN: number
  weekCount: number
  studentsWithRepeatWeeks: number
  medianWeeksObserved: number | null
  observedCells: number
  possibleCells: number
  completenessPct: number | null
  weekly: LongitudinalWeek[]
  note: string
}

export type PathwayRow = {
  path: string
  students: number
}

export type PathwayAnalytics = {
  studentsWithSequence: number
  paths: InstitutionNamedCount[]
  suppressedStudents: number
  note: string
  unblock: string
}

export type RegisteredModel = {
  id: number
  name: string
  outcome: string
  status: string
  algorithm: string | null
  validationDesign: string | null
  heldOutN: number | null
}

export type PredictiveModelStatus = {
  available: boolean
  models: RegisteredModel[]
  unblock: string
  heuristicNote: string
}

function num(row: Record<string, unknown> | undefined, key: string): number {
  return Number(row?.[key] ?? 0)
}

function scoreOrNull(row: Record<string, unknown> | undefined, key: string): number | null {
  const v = row?.[key]
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function windowForDays(days: number): (typeof TRANSFER_WINDOWS)[number] | null {
  return TRANSFER_WINDOWS.find((w) => days >= w.minDays && days <= w.maxDays) ?? null
}

export function formatPathway(steps: string[]): string {
  return steps.filter(Boolean).join(" → ")
}

function emptyWindows(): LatencyWindow[] {
  return TRANSFER_WINDOWS.map((w) => ({
    key: w.key,
    label: w.label,
    n: 0,
    score: null,
    insufficient: true,
  }))
}

function windowsFromRows(rows: Array<Record<string, unknown>>): LatencyWindow[] {
  const byKey = new Map(rows.map((row) => [String(row.key), row]))
  return TRANSFER_WINDOWS.map((w) => {
    const row = byKey.get(w.key)
    const n = num(row, "n")
    const score = n >= MIN_CELL_SIZE ? scoreOrNull(row, "score") : null
    return { key: w.key, label: w.label, n, score, insufficient: n < MIN_CELL_SIZE }
  })
}

export async function getDelayedTransferWindows(
  scope: InstitutionScope,
  institutionId: number,
): Promise<DelayedTransferAnalytics> {
  const transferNote =
    "Delayed transfer is the next independent-tagged assessment after Cora, bucketed by lag. Descriptive association only — not an AI effect."
  const subsequentNote =
    "Subsequent assessment is any later completed quiz after Cora. It is follow-through latency, not transfer."
  const unblock =
    "Tag later assessments as AI_RESTRICTED, AI_UNAVAILABLE, or INDEPENDENT_CHECK to enable transfer windows."
  if (scope.courseIds.length === 0) {
    return {
      transferWindows: emptyWindows(),
      subsequentWindows: emptyWindows(),
      subsequentNote,
      transferNote,
      unblock,
    }
  }

  const [transfer, subsequent] = await Promise.all([
    sql`
      WITH cora AS (
        SELECT u.user_id, u.created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      ),
      next_ind AS (
        SELECT qa.score,
          FLOOR(EXTRACT(EPOCH FROM (qa.completed_at - c.created_at)) / 86400.0)::int AS days,
          ROW_NUMBER() OVER (PARTITION BY c.user_id, c.created_at ORDER BY qa.completed_at) AS rn
        FROM cora c
        JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL AND qa.completed_at > c.created_at
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})
          AND qa.completed_at <= c.created_at + INTERVAL '60 days'
      )
      SELECT
        CASE
          WHEN days BETWEEN 0 AND 7 THEN 'd0_7'
          WHEN days BETWEEN 8 AND 14 THEN 'd8_14'
          WHEN days BETWEEN 15 AND 28 THEN 'd15_28'
          WHEN days BETWEEN 29 AND 60 THEN 'd29_60'
        END AS key,
        COUNT(*)::int AS n,
        ROUND(AVG(score)::numeric, 1) AS score
      FROM next_ind
      WHERE rn = 1 AND days BETWEEN 0 AND 60
      GROUP BY 1
    `.catch(() => []),
    sql`
      WITH cora AS (
        SELECT u.user_id, u.created_at
        FROM institution_cora_usage u
        JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      ),
      next_q AS (
        SELECT qa.score,
          FLOOR(EXTRACT(EPOCH FROM (qa.completed_at - c.created_at)) / 86400.0)::int AS days,
          ROW_NUMBER() OVER (PARTITION BY c.user_id, c.created_at ORDER BY qa.completed_at) AS rn
        FROM cora c
        JOIN quiz_attempts qa ON qa.student_id = c.user_id AND qa.deleted_at IS NULL AND qa.completed_at > c.created_at
          AND qa.completed_at <= c.created_at + INTERVAL '60 days'
      )
      SELECT
        CASE
          WHEN days BETWEEN 0 AND 7 THEN 'd0_7'
          WHEN days BETWEEN 8 AND 14 THEN 'd8_14'
          WHEN days BETWEEN 15 AND 28 THEN 'd15_28'
          WHEN days BETWEEN 29 AND 60 THEN 'd29_60'
        END AS key,
        COUNT(*)::int AS n,
        ROUND(AVG(score)::numeric, 1) AS score
      FROM next_q
      WHERE rn = 1 AND days BETWEEN 0 AND 60
      GROUP BY 1
    `.catch(() => []),
  ])

  return {
    transferWindows: windowsFromRows(transfer as Array<Record<string, unknown>>),
    subsequentWindows: windowsFromRows(subsequent as Array<Record<string, unknown>>),
    subsequentNote,
    transferNote,
    unblock,
  }
}

export async function getLongitudinalAnalytics(scope: InstitutionScope): Promise<LongitudinalAnalytics> {
  const note =
    "Repeated weekly observations for the same learners. This is a descriptive panel, not a growth-curve or mixed-effects estimate."
  if (scope.courseIds.length === 0) {
    return {
      rosterN: 0,
      weekCount: 0,
      studentsWithRepeatWeeks: 0,
      medianWeeksObserved: null,
      observedCells: 0,
      possibleCells: 0,
      completenessPct: null,
      weekly: [],
      note,
    }
  }

  const [summary, weekly] = await Promise.all([
    sql`
      WITH weeks AS (
        SELECT gs::date AS week
        FROM generate_series(date_trunc('week', ${scope.from}::date), date_trunc('week', ${scope.to}::date), INTERVAL '1 week') gs
      ),
      roster AS (
        SELECT id FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL
      ),
      obs AS (
        SELECT student_id, week FROM (
          SELECT pa.student_id, date_trunc('week', COALESCE(pa.completed_at, pa.started_at))::date AS week
          FROM practice_attempts pa
          JOIN roster r ON r.id = pa.student_id
          WHERE COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
            AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
          UNION
          SELECT qa.student_id, date_trunc('week', qa.completed_at)::date AS week
          FROM quiz_attempts qa
          JOIN roster r ON r.id = qa.student_id
          WHERE qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
            AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        ) u
        GROUP BY 1, 2
      ),
      per_student AS (
        SELECT student_id, COUNT(*)::int AS weeks_n FROM obs GROUP BY 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM roster) AS roster_n,
        (SELECT COUNT(*)::int FROM weeks) AS week_count,
        (SELECT COUNT(*)::int FROM per_student WHERE weeks_n >= 2) AS repeat_n,
        (SELECT COUNT(*)::int FROM obs) AS observed_cells,
        (SELECT ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY weeks_n))::numeric, 1) FROM per_student) AS median_weeks
    `.catch(() => [{ roster_n: 0, week_count: 0, repeat_n: 0, observed_cells: 0, median_weeks: null }]),
    sql`
      WITH weeks AS (
        SELECT gs::date AS week
        FROM generate_series(date_trunc('week', ${scope.from}::date), date_trunc('week', ${scope.to}::date), INTERVAL '1 week') gs
      ),
      practice AS (
        SELECT date_trunc('week', COALESCE(pa.completed_at, pa.started_at))::date AS week,
          COUNT(DISTINCT pa.student_id)::int AS students,
          AVG(pa.score_percentage::float) AS acc
        FROM practice_attempts pa
        JOIN students st ON st.id = pa.student_id
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
          AND COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
          AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
        GROUP BY 1
      ),
      assess AS (
        SELECT date_trunc('week', qa.completed_at)::date AS week,
          COUNT(DISTINCT qa.student_id)::int AS students,
          AVG(qa.score::float) AS score
        FROM quiz_attempts qa
        JOIN students st ON st.id = qa.student_id
        WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
          AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
          AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
        GROUP BY 1
      )
      SELECT w.week,
        COALESCE(p.students, 0) + COALESCE(a.students, 0) AS active_est,
        GREATEST(COALESCE(p.students, 0), COALESCE(a.students, 0)) AS students_active,
        CASE WHEN COALESCE(p.students, 0) >= ${MIN_CELL_SIZE} THEN ROUND(p.acc::numeric, 1) END AS mean_practice,
        CASE WHEN COALESCE(a.students, 0) >= ${MIN_CELL_SIZE} THEN ROUND(a.score::numeric, 1) END AS mean_assessment
      FROM weeks w
      LEFT JOIN practice p ON p.week = w.week
      LEFT JOIN assess a ON a.week = w.week
      ORDER BY w.week
    `.catch(() => []),
  ])

  const s = (summary[0] ?? {}) as Record<string, unknown>
  const rosterN = num(s, "roster_n")
  const weekCount = num(s, "week_count")
  const observedCells = num(s, "observed_cells")
  const possibleCells = rosterN * weekCount
  return {
    rosterN,
    weekCount,
    studentsWithRepeatWeeks: num(s, "repeat_n"),
    medianWeeksObserved: s.median_weeks != null ? Number(s.median_weeks) : null,
    observedCells,
    possibleCells,
    completenessPct: possibleCells > 0 ? Math.round((observedCells / possibleCells) * 1000) / 10 : null,
    weekly: (weekly as Array<Record<string, unknown>>).map((row) => {
      const week = parsePgDateOnly(row.week)
      return {
        week,
        label: formatWeekLabel(week),
        studentsActive: num(row, "students_active"),
        meanPractice: scoreOrNull(row, "mean_practice"),
        meanAssessment: scoreOrNull(row, "mean_assessment"),
      }
    }),
    note,
  }
}

export async function getLearningPathways(
  scope: InstitutionScope,
  institutionId: number,
): Promise<PathwayAnalytics> {
  const note =
    "A pathway is the first three activity types (practice, Cora, assessment) in time order. It is a sequence count, not an optimal path."
  const unblock = "Pathways appear once the same learners have at least two timed activities in the window."
  if (scope.courseIds.length === 0) {
    return { studentsWithSequence: 0, paths: [], suppressedStudents: 0, note, unblock }
  }

  const rows = await sql`
    WITH events AS (
      SELECT pa.student_id, COALESCE(pa.completed_at, pa.started_at) AS ts, 'practice' AS kind
      FROM practice_attempts pa
      JOIN students st ON st.id = pa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
        AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
      UNION ALL
      SELECT u.user_id, u.created_at, 'cora'
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      UNION ALL
      SELECT qa.student_id, qa.completed_at, 'assessment'
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
    ),
    ordered AS (
      SELECT student_id, kind, ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY ts) AS rn
      FROM events
    ),
    paths AS (
      SELECT student_id, STRING_AGG(kind, ' → ' ORDER BY rn) AS path
      FROM ordered
      WHERE rn <= 3
      GROUP BY 1
    )
    SELECT path, COUNT(*)::int AS n
    FROM paths
    GROUP BY 1
    ORDER BY n DESC
  `.catch(() => [])

  const all = (rows as Array<Record<string, unknown>>).map((row) => ({
    path: String(row.path ?? ""),
    students: Number(row.n ?? 0),
  }))
  const shown = all.filter((p) => p.students >= MIN_CELL_SIZE)
  const suppressedStudents = all.filter((p) => p.students < MIN_CELL_SIZE).reduce((s, p) => s + p.students, 0)
  return {
    studentsWithSequence: all.reduce((s, p) => s + p.students, 0),
    paths: shown.map((p) => ({ key: p.path, name: p.path, value: p.students })),
    suppressedStudents,
    note,
    unblock,
  }
}

export async function getPredictiveModelStatus(institutionId: number): Promise<PredictiveModelStatus> {
  const unblock =
    "A validated predictive model needs a registered fit with held-out or temporal evaluation. Heuristic attention flags are not a model."
  const heuristicNote =
    "Student Success flags remain transparent heuristics. This page will not invent risk scores or AUC values."
  const rows = await sql`
    SELECT id, name, outcome, status, algorithm, validation_design, held_out_n
    FROM institution_research_models
    WHERE institution_id = ${institutionId}
    ORDER BY created_at DESC
    LIMIT 20
  `.catch(() => [])
  const models: RegisteredModel[] = (rows as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    outcome: String(row.outcome),
    status: String(row.status),
    algorithm: row.algorithm != null ? String(row.algorithm) : null,
    validationDesign: row.validation_design != null ? String(row.validation_design) : null,
    heldOutN: row.held_out_n != null ? Number(row.held_out_n) : null,
  }))
  const available = models.some((m) => m.status === "validated" && (m.heldOutN ?? 0) >= MIN_CELL_SIZE)
  return { available, models, unblock, heuristicNote }
}

export async function buildMixedEffectsExport(
  institutionId: number,
  actorUserId: number,
  scope: InstitutionScope,
): Promise<{ filename: string; csv: string; rowCount: number }> {
  if (scope.courseIds.length === 0) {
    return { filename: "mixed-effects-panel.csv", csv: toCsv(["research_student_id"], []), rowCount: 0 }
  }
  const rows = await sql`
    WITH weeks AS (
      SELECT gs::date AS week,
        ROW_NUMBER() OVER (ORDER BY gs) - 1 AS time_index
      FROM generate_series(date_trunc('week', ${scope.from}::date), date_trunc('week', ${scope.to}::date), INTERVAL '1 week') gs
    ),
    roster AS (
      SELECT id, course_id FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL
    ),
    practice AS (
      SELECT pa.student_id, date_trunc('week', COALESCE(pa.completed_at, pa.started_at))::date AS week,
        AVG(pa.score_percentage::float) AS practice_accuracy
      FROM practice_attempts pa
      JOIN roster r ON r.id = pa.student_id
      WHERE COALESCE(pa.completed_at, pa.started_at)::date >= ${scope.from}::date
        AND COALESCE(pa.completed_at, pa.started_at)::date <= ${scope.to}::date
      GROUP BY 1, 2
    ),
    assess AS (
      SELECT qa.student_id, date_trunc('week', qa.completed_at)::date AS week,
        AVG(qa.score::float) AS assessment_score
      FROM quiz_attempts qa
      JOIN roster r ON r.id = qa.student_id
      WHERE qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
      GROUP BY 1, 2
    ),
    cora AS (
      SELECT u.user_id AS student_id, date_trunc('week', u.created_at)::date AS week,
        COUNT(*)::int AS cora_sessions
      FROM institution_cora_usage u
      JOIN roster r ON r.id = u.user_id
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      GROUP BY 1, 2
    ),
    panel AS (
      SELECT r.id AS student_id, r.course_id, w.week, w.time_index,
        p.practice_accuracy, a.assessment_score, COALESCE(c.cora_sessions, 0) AS cora_sessions
      FROM roster r
      CROSS JOIN weeks w
      LEFT JOIN practice p ON p.student_id = r.id AND p.week = w.week
      LEFT JOIN assess a ON a.student_id = r.id AND a.week = w.week
      LEFT JOIN cora c ON c.student_id = r.id AND c.week = w.week
    ),
    keep AS (
      SELECT student_id FROM panel
      WHERE practice_accuracy IS NOT NULL OR assessment_score IS NOT NULL OR cora_sessions > 0
      GROUP BY 1
      HAVING COUNT(*) >= 2
    )
    SELECT p.student_id, p.course_id, p.week, p.time_index, p.practice_accuracy, p.assessment_score, p.cora_sessions
    FROM panel p
    JOIN keep k ON k.student_id = p.student_id
    WHERE p.practice_accuracy IS NOT NULL OR p.assessment_score IS NOT NULL OR p.cora_sessions > 0
    ORDER BY p.student_id, p.time_index
  `.catch(() => [])

  const csvRows = (rows as Array<Record<string, unknown>>).map((row) => [
    researchStudentId(institutionId, Number(row.student_id)),
    parsePgDateOnly(row.week),
    Number(row.time_index ?? 0),
    Number(row.course_id ?? 0),
    row.practice_accuracy != null ? Math.round(Number(row.practice_accuracy) * 10) / 10 : null,
    row.assessment_score != null ? Math.round(Number(row.assessment_score) * 10) / 10 : null,
    Number(row.cora_sessions ?? 0),
  ])
  const headerNote =
    "# Long format for mixed-effects models such as lmer(y ~ time_index + (1 | research_student_id)). CourseCollab does not estimate this model.\n"
  const csv =
    headerNote +
    toCsv(
      ["research_student_id", "week", "time_index", "course_id", "practice_accuracy", "assessment_score", "cora_sessions"],
      csvRows,
    )

  await sql`
    INSERT INTO institution_research_export_logs (
      institution_id, actor_user_id, dataset, filters_json, row_count
    ) VALUES (
      ${institutionId},
      ${actorUserId},
      'mixed_effects',
      ${JSON.stringify({ from: scope.from, to: scope.to })},
      ${csvRows.length}
    )
  `.catch(() => [])

  return { filename: "mixed-effects-panel.csv", csv, rowCount: csvRows.length }
}
