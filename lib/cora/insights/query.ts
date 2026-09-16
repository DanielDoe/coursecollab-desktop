import { addDays } from "date-fns"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { sql } from "@/lib/db"
import { CENTRAL_TIMEZONE } from "@/lib/timezone"
import { CATEGORY_LABELS, type CoraInteractionCategory, type DependenceLabel, type HealthBand, type RiskLevel } from "@/lib/cora/insights/taxonomy"
import { classifyInteractionCategory } from "@/lib/cora/insights/classify"
import {
  CODEBENCH_MISTAKE_DETAIL,
  CODEBENCH_MISTAKE_LABELS,
  scanCodebenchMistakes,
  type CodebenchMistakeKind,
} from "@/lib/cora/insights/codebench-mistake-scan"
import type { FacultyInsightsScope } from "@/lib/cora/insights/scope"
import { buildClassSummary } from "@/lib/cora/insights/summary"

type NumRow = Record<string, unknown>

function n(v: unknown): number {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function pctChange(curr: number, prev: number): number | null {
  if (prev <= 0 && curr <= 0) return null
  if (prev <= 0) return curr > 0 ? 100 : null
  return Math.round(((curr - prev) / prev) * 100)
}

function iso(d: Date) {
  return d.toISOString()
}

function dayKey(v: unknown) {
  if (v instanceof Date && Number.isFinite(v.getTime())) {
    // node-pg DATE values arrive as UTC midnight of that calendar day
    return v.toISOString().slice(0, 10)
  }
  const raw = String(v ?? "")
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(raw)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : raw.slice(0, 10)
}

function dayLabel(key: string) {
  const d = fromZonedTime(`${key}T12:00:00`, CENTRAL_TIMEZONE)
  return Number.isFinite(d.getTime())
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: CENTRAL_TIMEZONE })
    : key
}

function fillTimelineDays(
  rows: Array<{ date: string; interactions: number; students: number; debugging: number; analysis: number; planning: number; other: number }>,
  from: Date,
  to: Date,
) {
  const byDay = new Map(rows.map((r) => [r.date, r]))
  const out: Array<(typeof rows)[number] & { dateLabel: string }> = []
  let key = formatInTimeZone(from, CENTRAL_TIMEZONE, "yyyy-MM-dd")
  const endKey = formatInTimeZone(to, CENTRAL_TIMEZONE, "yyyy-MM-dd")
  while (key <= endKey) {
    const row = byDay.get(key) ?? {
      date: key,
      interactions: 0,
      students: 0,
      debugging: 0,
      analysis: 0,
      planning: 0,
      other: 0,
    }
    out.push({ ...row, dateLabel: dayLabel(key) })
    key = formatInTimeZone(addDays(fromZonedTime(`${key}T12:00:00`, CENTRAL_TIMEZONE), 1), CENTRAL_TIMEZONE, "yyyy-MM-dd")
  }
  return out
}

function rosterIdArray(ids: number[]) {
  const clean = ids.map((id) => Math.trunc(Number(id))).filter((id) => Number.isFinite(id) && id > 0)
  return clean.length ? `ARRAY[${clean.join(",")}]::int[]` : "ARRAY[]::int[]"
}

/** Fragment only — never call `sql` here; that would execute `s.id = ANY(...)` as its own query. */
function rosterSql(scope: FacultyInsightsScope) {
  return sql.unsafe(`s.id = ANY(${rosterIdArray(scope.rosterIds)}) AND ${scope.studentPred}`)
}

function usageModuleLabel(module: string | null | undefined, feature?: string | null) {
  const raw = String(module || feature || "").toLowerCase()
  if (raw.includes("error-spot")) return "Error spotting"
  if (raw.includes("debug")) return "Debugging"
  if (raw.includes("analyze")) return "Code analysis"
  if (raw.includes("learning-plan") || raw.includes("study_plan") || raw.includes("study-plan")) return "Learning plan"
  if (raw.includes("improve")) return "Code improvement"
  if (raw.includes("style")) return "Style review"
  if (raw.includes("cora-agent")) return "Cora coding help"
  if (raw.includes("codebench")) return "CodeBench help"
  return String(module || feature || "Cora help").replace(/[_-]+/g, " ")
}

function isMistakeModule(module: string | null | undefined, feature?: string | null) {
  const raw = `${module ?? ""} ${feature ?? ""}`.toLowerCase()
  return /debug|error-spot|error_spot|improve|style-review|mistake/.test(raw)
}

async function loadUsageModuleRows(scope: FacultyInsightsScope, from = scope.range.from, to = scope.range.to) {
  if (scope.rosterIds.length === 0) return [] as NumRow[]
  return (await sql`
    SELECT e.feature, e.module, COUNT(*)::int AS n, COUNT(DISTINCT e.user_id)::int AS students
    FROM cora_usage_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.user_role = 'student'
      AND e.created_at >= ${iso(from)} AND e.created_at <= ${iso(to)}
      AND ${rosterSql(scope)}
    GROUP BY 1, 2
    ORDER BY n DESC
  `.catch(() => [])) as NumRow[]
}

export async function loadInsightsFilters(scope: FacultyInsightsScope) {
  const [assessments, topics, students] = await Promise.all([
    sql`
      SELECT q.id, q.title, q.assessment_type
      FROM quizzes q
      WHERE q.deleted_at IS NULL
        AND (
          q.course_id = ${scope.courseId}
          OR EXISTS (
            SELECT 1 FROM quiz_session_access qsa
            JOIN sessions sess ON sess.id = qsa.session_id
            WHERE qsa.quiz_id = q.id AND sess.course_id = ${scope.courseId}
          )
        )
      ORDER BY q.available_from DESC NULLS LAST, q.id DESC
      LIMIT 80
    `.catch(() => []),
    sql`
      SELECT concept AS topic, COUNT(*)::int AS n
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.course_id = ${scope.courseId}
        AND e.occurred_at >= ${iso(scope.range.from)}
        AND e.occurred_at <= ${iso(scope.range.to)}
        AND ${rosterSql(scope)}
        AND e.concept IS NOT NULL AND e.concept <> ''
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 40
    `.catch(() => []),
    sql`
      SELECT s.id, s.full_name, s.student_id AS code, s.section
      FROM students s
      WHERE ${rosterSql(scope)}
      ORDER BY s.full_name
      LIMIT 400
    `.catch(() => []),
  ])
  return {
    assessments: (assessments as NumRow[]).map((r) => ({
      id: n(r.id),
      title: String(r.title ?? "Assessment"),
      type: r.assessment_type != null ? String(r.assessment_type) : null,
    })),
    topics: (topics as NumRow[]).map((r) => String(r.topic)),
    students: (students as NumRow[]).map((r) => ({
      id: n(r.id),
      name: String(r.full_name ?? "Student"),
      code: String(r.code ?? ""),
      section: r.section != null ? String(r.section) : null,
    })),
    range: scope.range,
    course: { id: scope.courseId, code: scope.courseCode, title: scope.courseTitle },
  }
}

async function countWindow(
  scope: FacultyInsightsScope,
  from: Date,
  to: Date,
): Promise<{ sessions: number; students: number; blocked: number; assistedKnown: number; assistedCorrect: number }> {
  if (scope.rosterIds.length === 0) {
    return { sessions: 0, students: 0, blocked: 0, assistedKnown: 0, assistedCorrect: 0 }
  }
  const [usage, assessment, learning, structured, tutor] = await Promise.all([
    sql`
      SELECT COUNT(*)::int AS sessions, COUNT(DISTINCT e.user_id)::int AS students
      FROM cora_usage_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.user_role = 'student'
        AND e.created_at >= ${iso(from)} AND e.created_at <= ${iso(to)}
        AND ${rosterSql(scope)}
        AND (${scope.courseId} = 0 OR e.course_id IS NULL OR e.course_id = ${scope.courseId})
    `.catch(() => [{ sessions: 0, students: 0 }]),
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(DISTINCT e.student_id)::int AS students,
        COUNT(*) FILTER (WHERE e.answer_blocked OR e.was_answer_seeking)::int AS blocked
      FROM cora_assessment_events e
      JOIN students s ON s.id = e.student_id
      WHERE e.created_at >= ${iso(from)} AND e.created_at <= ${iso(to)}
        AND ${rosterSql(scope)}
        AND (e.course_id IS NULL OR e.course_id = ${scope.courseId})
    `.catch(() => [{ sessions: 0, students: 0, blocked: 0 }]),
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(DISTINCT i.student_id)::int AS students,
        COUNT(*) FILTER (WHERE i.next_attempt_correct IS NOT NULL)::int AS known,
        COUNT(*) FILTER (WHERE i.next_attempt_correct IS TRUE)::int AS correct
      FROM ai_learning_interactions i
      JOIN students s ON s.id = i.student_id
      WHERE i.created_at >= ${iso(from)} AND i.created_at <= ${iso(to)}
        AND ${rosterSql(scope)}
        AND (i.course_id IS NULL OR i.course_id = ${scope.courseId})
    `.catch(() => [{ sessions: 0, students: 0, known: 0, correct: 0 }]),
    sql`
      SELECT
        COUNT(*)::int AS sessions,
        COUNT(DISTINCT e.user_id)::int AS students,
        COUNT(*) FILTER (WHERE e.answer_blocked OR e.answer_seeking_detected)::int AS blocked,
        COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS known,
        COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS correct
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.occurred_at >= ${iso(from)} AND e.occurred_at <= ${iso(to)}
        AND ${rosterSql(scope)}
        AND (e.course_id IS NULL OR e.course_id = ${scope.courseId})
    `.catch(() => [{ sessions: 0, students: 0, blocked: 0, known: 0, correct: 0 }]),
    sql`
      SELECT COUNT(*)::int AS sessions, COUNT(DISTINCT aic.student_id)::int AS students
      FROM ai_tutor_conversations aic
      JOIN students s ON s.id = aic.student_id
      WHERE aic.created_at >= ${iso(from)} AND aic.created_at <= ${iso(to)}
        AND ${rosterSql(scope)}
    `.catch(() => [{ sessions: 0, students: 0 }]),
  ])
  const u = (usage as NumRow[])[0] ?? {}
  const a = (assessment as NumRow[])[0] ?? {}
  const l = (learning as NumRow[])[0] ?? {}
  const st = (structured as NumRow[])[0] ?? {}
  const tu = (tutor as NumRow[])[0] ?? {}
  const structuredSessions = n(st.sessions)
  if (structuredSessions > 0) {
    return {
      sessions: structuredSessions,
      students: n(st.students),
      blocked: n(st.blocked),
      assistedKnown: n(st.known),
      assistedCorrect: n(st.correct),
    }
  }
  return {
    sessions: Math.max(n(u.sessions) + n(a.sessions) + n(l.sessions), n(tu.sessions)),
    students: Math.max(n(u.students), n(a.students), n(l.students), n(tu.students)),
    blocked: n(a.blocked),
    assistedKnown: n(l.known),
    assistedCorrect: n(l.correct),
  }
}

export async function loadOverview(scope: FacultyInsightsScope) {
  const empty = scope.rosterIds.length === 0
  const [curr, prev, health, concepts, needs] = await Promise.all([
    empty
      ? Promise.resolve({ sessions: 0, students: 0, blocked: 0, assistedKnown: 0, assistedCorrect: 0 })
      : countWindow(scope, scope.range.from, scope.range.to),
    empty
      ? Promise.resolve({ sessions: 0, students: 0, blocked: 0, assistedKnown: 0, assistedCorrect: 0 })
      : countWindow(scope, scope.range.prevFrom, scope.range.prevTo),
    loadHealth(scope),
    loadConceptBars(scope, 8),
    loadStudentNeeds(scope, 80),
  ])
  const actions = buildActionsFrom(concepts, needs.students)
  const attention = needs.students.filter((s) => s.risk === "high" || s.risk === "medium")
  const high = attention.filter((s) => s.risk === "high").length
  const assisted =
    curr.assistedKnown >= 8 ? Math.round((curr.assistedCorrect / curr.assistedKnown) * 100) : null
  const prevAssisted =
    prev.assistedKnown >= 8 ? Math.round((prev.assistedCorrect / prev.assistedKnown) * 100) : null
  const avg = curr.students > 0 ? Math.round((curr.sessions / curr.students) * 10) / 10 : null
  const prevAvg = prev.students > 0 ? Math.round((prev.sessions / prev.students) * 10) / 10 : null

  const kpis = [
    {
      id: "cora_sessions",
      value: curr.sessions,
      delta: pctChange(curr.sessions, prev.sessions),
      sub: `${scope.range.label} vs previous`,
    },
    {
      id: "active_students",
      value: curr.students,
      delta: pctChange(curr.students, prev.students),
      sub: "Used Cora in this window",
    },
    {
      id: "students_needing_attention",
      value: attention.length,
      delta: null,
      sub: high > 0 ? `${high} high priority` : "No high-priority flags",
    },
    {
      id: "avg_requests",
      value: avg,
      delta: avg != null && prevAvg != null ? pctChange(avg, prevAvg) : null,
      sub: "Among students who used Cora",
    },
    {
      id: "assisted_success",
      value: assisted,
      delta: assisted != null && prevAssisted != null ? assisted - prevAssisted : null,
      sub: curr.assistedKnown >= 8 ? `${curr.assistedKnown} known follow-ups` : "Not enough data yet",
    },
    {
      id: "answers_blocked",
      value: curr.blocked,
      delta: pctChange(curr.blocked, prev.blocked),
      sub: "Integrity signal, not misconduct",
    },
  ]

  return {
    kpis,
    summary: buildClassSummary({
      rangeLabel: scope.range.label,
      concepts,
      attentionCount: attention.length,
      highCount: high,
      noImprovement: needs.students.filter((s) => s.primaryConcern.includes("without subsequent")).length,
      assistedSuccess: assisted,
      topIndependentWeak: concepts.filter((c) => c.independentSuccess != null && c.successAfter != null && (c.independentSuccess as number) + 15 < (c.successAfter as number)).slice(0, 2),
    }),
    health,
    attentionPreview: attention.slice(0, 6),
    recommendedActions: actions.slice(0, 4),
    sampleOk: curr.sessions > 0,
  }
}

async function loadHealth(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) {
    return { bands: [] as Array<{ band: HealthBand; count: number; pct: number }>, sample: 0 }
  }
  const rows = (await sql`
    WITH scored AS (
      SELECT qa.student_id, AVG(qa.score::float) AS quiz_avg, COUNT(*)::int AS items
      FROM quiz_attempts qa
      WHERE qa.student_id = ANY(${scope.rosterIds})
        AND qa.completed_at >= ${iso(scope.range.from)}
        AND qa.completed_at <= ${iso(scope.range.to)}
      GROUP BY qa.student_id
    )
    SELECT
      COUNT(*) FILTER (WHERE items >= 3 AND quiz_avg >= 80)::int AS strong,
      COUNT(*) FILTER (WHERE items >= 3 AND quiz_avg >= 60 AND quiz_avg < 80)::int AS developing,
      COUNT(*) FILTER (WHERE items >= 3 AND quiz_avg >= 40 AND quiz_avg < 60)::int AS struggling,
      COUNT(*) FILTER (WHERE items >= 3 AND quiz_avg < 40)::int AS critical,
      COUNT(*) FILTER (WHERE items >= 3)::int AS sample
    FROM scored
  `.catch(() => [{ strong: 0, developing: 0, struggling: 0, critical: 0, sample: 0 }])) as NumRow[]
  const r = rows[0] ?? {}
  const sample = n(r.sample)
  const raw: Array<{ band: HealthBand; count: number }> = [
    { band: "strong", count: n(r.strong) },
    { band: "developing", count: n(r.developing) },
    { band: "struggling", count: n(r.struggling) },
    { band: "critical", count: n(r.critical) },
  ]
  return {
    bands: raw.map((b) => ({ ...b, pct: sample > 0 ? Math.round((b.count / sample) * 100) : 0 })),
    sample,
  }
}

export async function loadConceptBars(scope: FacultyInsightsScope, limit = 12) {
  if (scope.rosterIds.length === 0) return []
  const structured = (await sql`
    SELECT
      COALESCE(NULLIF(e.concept, ''), 'Course help') AS concept,
      COUNT(*)::int AS requests,
      COUNT(DISTINCT e.user_id)::int AS students,
      AVG(e.assistance_level)::float AS hint_depth,
      COUNT(*) FILTER (WHERE e.correct_after IS FALSE)::int AS incorrect,
      COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS after_ok,
      COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS after_known,
      COUNT(*) FILTER (WHERE e.independent_correct IS TRUE)::int AS indep_ok,
      COUNT(*) FILTER (WHERE e.independent_correct IS NOT NULL)::int AS indep_known
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
      AND (e.course_id IS NULL OR e.course_id = ${scope.courseId})
    GROUP BY 1
    ORDER BY students DESC, requests DESC
    LIMIT ${limit}
  `.catch(() => [])) as NumRow[]

  if (structured.length > 0) {
    return structured.map(mapConceptRow)
  }

  const legacy = (await sql`
    SELECT
      COALESCE(NULLIF(aic.topic, ''), 'Course help') AS concept,
      COUNT(*)::int AS requests,
      COUNT(DISTINCT aic.student_id)::int AS students
    FROM ai_tutor_conversations aic
    JOIN students s ON s.id = aic.student_id
    WHERE aic.created_at >= ${iso(scope.range.from)} AND aic.created_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1
    ORDER BY students DESC
    LIMIT ${limit}
  `.catch(() => [])) as NumRow[]
  if (legacy.length > 0) {
    return legacy.map((r) => ({
      concept: String(r.concept),
      students: n(r.students),
      requests: n(r.requests),
      incorrectAttempts: null as number | null,
      hintDepth: null as number | null,
      successAfter: null as number | null,
      independentSuccess: null as number | null,
    }))
  }

  const usage = await loadUsageModuleRows(scope)
  const merged = new Map<string, { concept: string; students: number; requests: number }>()
  for (const r of usage) {
    const concept = usageModuleLabel(String(r.module ?? ""), String(r.feature ?? ""))
    const prev = merged.get(concept)
    merged.set(concept, {
      concept,
      students: Math.max(prev?.students ?? 0, n(r.students)),
      requests: (prev?.requests ?? 0) + n(r.n),
    })
  }
  return [...merged.values()]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, limit)
    .map((r) => ({
      concept: r.concept,
      students: r.students,
      requests: r.requests,
      incorrectAttempts: null as number | null,
      hintDepth: null as number | null,
      successAfter: null as number | null,
      independentSuccess: null as number | null,
    }))
}

function mapConceptRow(r: NumRow) {
  const afterKnown = n(r.after_known)
  const indepKnown = n(r.indep_known)
  return {
    concept: String(r.concept),
    students: n(r.students),
    requests: n(r.requests),
    incorrectAttempts: n(r.incorrect),
    hintDepth: r.hint_depth != null ? Math.round(n(r.hint_depth) * 10) / 10 : null,
    successAfter: afterKnown >= 5 ? Math.round((n(r.after_ok) / afterKnown) * 100) : null,
    independentSuccess: indepKnown >= 5 ? Math.round((n(r.indep_ok) / indepKnown) * 100) : null,
  }
}

export async function loadStudentNeeds(scope: FacultyInsightsScope, limit = 80) {
  if (scope.rosterIds.length === 0) return { students: [], matrix: [] }
  const rows = (await sql`
    SELECT
      s.id, s.full_name, s.student_id AS code, s.section,
      q.quiz_avg AS performance,
      COALESCE(q.items, 0)::int AS items,
      COALESCE(NULLIF(c.sessions, 0), u.sessions, t.sessions, 0)::int AS cora_sessions,
      c.hint_depth,
      COALESCE(c.no_gain, 0)::int AS no_gain,
      COALESCE(c.seeking, 0)::int AS seeking,
      COALESCE(c.last_at, u.last_at, t.last_at) AS last_at,
      COALESCE(r.repeats, 0)::int AS repeats,
      COALESCE(m.missed, 0)::int AS missed,
      p.prev_perf
    FROM students s
    LEFT JOIN (
      SELECT student_id, AVG(score::float) AS quiz_avg, COUNT(*)::int AS items
      FROM quiz_attempts
      WHERE student_id = ANY(${scope.rosterIds})
        AND completed_at >= ${iso(scope.range.from)}
        AND completed_at <= ${iso(scope.range.to)}
      GROUP BY student_id
    ) q ON q.student_id = s.id
    LEFT JOIN (
      SELECT student_id, AVG(score::float) AS prev_perf
      FROM quiz_attempts
      WHERE student_id = ANY(${scope.rosterIds})
        AND completed_at >= ${iso(scope.range.prevFrom)}
        AND completed_at <= ${iso(scope.range.prevTo)}
      GROUP BY student_id
    ) p ON p.student_id = s.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS sessions, AVG(assistance_level)::float AS hint_depth,
             COUNT(*) FILTER (WHERE correct_after IS FALSE)::int AS no_gain,
             COUNT(*) FILTER (WHERE answer_seeking_detected)::int AS seeking,
             MAX(occurred_at) AS last_at
      FROM cora_interaction_events
      WHERE user_id = ANY(${scope.rosterIds})
        AND occurred_at >= ${iso(scope.range.from)}
        AND occurred_at <= ${iso(scope.range.to)}
      GROUP BY user_id
    ) c ON c.user_id = s.id
    LEFT JOIN (
      SELECT e.user_id, COUNT(*)::int AS sessions, MAX(e.created_at) AS last_at
      FROM cora_usage_events e
      WHERE e.user_role = 'student'
        AND e.user_id = ANY(${scope.rosterIds})
        AND e.created_at >= ${iso(scope.range.from)}
        AND e.created_at <= ${iso(scope.range.to)}
      GROUP BY e.user_id
    ) u ON u.user_id = s.id
    LEFT JOIN (
      SELECT aic.student_id, COUNT(*)::int AS sessions, MAX(aic.created_at) AS last_at
      FROM ai_tutor_conversations aic
      WHERE aic.student_id = ANY(${scope.rosterIds})
        AND aic.created_at >= ${iso(scope.range.from)}
        AND aic.created_at <= ${iso(scope.range.to)}
      GROUP BY aic.student_id
    ) t ON t.student_id = s.id
    LEFT JOIN (
      SELECT user_id, COUNT(*)::int AS repeats
      FROM (
        SELECT user_id, concept
        FROM cora_interaction_events
        WHERE user_id = ANY(${scope.rosterIds})
          AND occurred_at >= ${iso(scope.range.from)}
        GROUP BY user_id, concept
        HAVING COUNT(*) >= 3
      ) t
      GROUP BY user_id
    ) r ON r.user_id = s.id
    LEFT JOIN (
      SELECT s2.id AS student_id, COUNT(*)::int AS missed
      FROM students s2
      JOIN quizzes qz ON qz.course_id = ${scope.courseId}
        AND qz.deleted_at IS NULL
        AND qz.available_until < NOW()
        AND qz.available_until >= ${iso(scope.range.from)}
      WHERE s2.id = ANY(${scope.rosterIds})
        AND NOT EXISTS (
          SELECT 1 FROM quiz_attempts qa WHERE qa.quiz_id = qz.id AND qa.student_id = s2.id
        )
      GROUP BY s2.id
    ) m ON m.student_id = s.id
    WHERE s.id = ANY(${scope.rosterIds})
      AND (s.deleted_at IS NULL)
  `.catch(() => [])) as NumRow[]

  const students = rows
    .map((r) => scoreStudentNeed(r))
    .filter((s) => (scope.studentId ? s.id === scope.studentId : s.risk !== "low" || s.coraSessions > 0))
    .sort((a, b) => rankRisk(b.risk) - rankRisk(a.risk) || b.coraSessions - a.coraSessions)
    .slice(0, limit)

  const matrix = students.map((s) => ({
    id: s.id,
    name: s.name,
    performance: s.performance,
    engagement: s.engagement,
    coraSessions: s.coraSessions,
    topDifficulty: s.primaryConcern,
    trend: s.trend,
    risk: s.risk,
  }))

  return { students, matrix }
}

function rankRisk(r: RiskLevel) {
  return r === "high" ? 4 : r === "medium" ? 3 : r === "watch" ? 2 : 1
}

function scoreStudentNeed(r: NumRow) {
  const id = n(r.id)
  const name = String(r.full_name ?? "Student")
  const performance = r.performance != null ? Math.round(n(r.performance)) : null
  const items = n(r.items)
  const sessions = n(r.cora_sessions)
  const repeats = n(r.repeats)
  const noGain = n(r.no_gain)
  const seeking = n(r.seeking)
  const missed = n(r.missed)
  const prev = r.prev_perf != null ? n(r.prev_perf) : null
  const lastAt = r.last_at ? new Date(String(r.last_at)) : null
  const hoursAgo = lastAt ? (Date.now() - lastAt.getTime()) / 3_600_000 : null
  const engagement = Math.max(0, Math.min(100, sessions * 8 + (items > 0 ? 20 : 0) - (hoursAgo != null && hoursAgo > 72 ? 15 : 0)))
  let trend: "improving" | "stable" | "declining" | "unknown" = "unknown"
  if (performance != null && prev != null) {
    const d = performance - prev
    trend = d <= -6 ? "declining" : d >= 6 ? "improving" : "stable"
  }

  const evidence: string[] = []
  if (repeats > 0) evidence.push(`${repeats} concept(s) with 3+ Cora requests`)
  if (noGain > 0) evidence.push(`${noGain} unsuccessful follow-ups after help`)
  if (sessions > 0) evidence.push(`${sessions} Cora sessions`)
  if (items > 0 && performance != null && performance < 60) evidence.push(`Scored items averaging ${performance}%`)
  if (missed > 0) evidence.push(`${missed} missed assessment(s)`)
  if (seeking > 0) evidence.push(`${seeking} answer-seeking redirects`)
  if (trend === "declining") evidence.push("Performance declined vs prior window")

  let risk: RiskLevel = "low"
  let primaryConcern = "No multi-signal concern"
  let action = "Monitor"
  const academicWeak = performance != null && items >= 3 && performance < 60
  const helpWithoutGain = noGain >= 3 || repeats >= 1
  if ((academicWeak && (helpWithoutGain || trend === "declining" || missed >= 2)) || (noGain >= 4 && repeats >= 1)) {
    risk = "high"
    primaryConcern = helpWithoutGain
      ? "Repeated difficulty without subsequent improvement"
      : missed >= 2
        ? "Missed work plus low scored performance"
        : "Declining performance with support signals"
    action = "Check in / assign targeted practice"
  } else if (academicWeak || (repeats >= 1 && sessions >= 4) || missed >= 1) {
    risk = "medium"
    primaryConcern = academicWeak ? "Low scored performance" : repeats ? "Same-topic repeated requests" : "Missed work"
    action = "Review concept and recent attempts"
  } else if (sessions >= 8 && performance != null && performance >= 70) {
    risk = "watch"
    primaryConcern = "High Cora volume with acceptable scores"
    action = "Encourage independent practice"
  }

  return {
    id,
    name,
    code: String(r.code ?? ""),
    section: r.section != null ? String(r.section) : null,
    risk,
    primaryConcern,
    evidence: evidence.slice(0, 4).join(" • ") || "Insufficient overlapping signals",
    trend,
    coraSessions: sessions,
    coraUsage: sessions >= 8 ? "High" : sessions >= 3 ? "Moderate" : sessions > 0 ? "Light" : "None",
    lastActivity: lastAt?.toISOString() ?? null,
    recommendedAction: action,
    performance,
    engagement,
    hintDepth: r.hint_depth != null ? Math.round(n(r.hint_depth) * 10) / 10 : null,
  }
}

export async function loadLearningGaps(scope: FacultyInsightsScope) {
  const [concepts, mistakes, heatmap, detailSeed] = await Promise.all([
    loadConceptBars(scope, 20),
    loadCommonMistakes(scope),
    loadTopicHeatmap(scope),
    loadConceptDetail(scope, scope.topic),
  ])
  return { concepts, mistakes, heatmap, conceptDetail: detailSeed }
}

export async function loadConceptDetail(scope: FacultyInsightsScope, concept: string | null) {
  if (!concept || scope.rosterIds.length === 0) return null
  const [stats, struggles, questions] = await Promise.all([
    sql`
      SELECT
        COUNT(DISTINCT e.user_id)::int AS students,
        COUNT(*)::int AS sessions,
        AVG(e.assistance_level)::float AS hint_depth,
        COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS after_ok,
        COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS after_known,
        COUNT(*) FILTER (WHERE e.independent_correct IS TRUE)::int AS indep_ok,
        COUNT(*) FILTER (WHERE e.independent_correct IS NOT NULL)::int AS indep_known,
        AVG(e.attempt_before)::float AS avg_attempts
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.concept = ${concept}
        AND e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
        AND ${rosterSql(scope)}
    `.catch(() => []),
    sql`
      SELECT COALESCE(e.subconcept, 'General difficulty') AS sub, COUNT(DISTINCT e.user_id)::int AS students
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.concept = ${concept}
        AND e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
        AND ${rosterSql(scope)}
      GROUP BY 1
      ORDER BY students DESC
      LIMIT 8
    `.catch(() => []),
    sql`
      SELECT e.question_id, e.question_type, COUNT(*)::int AS n
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.concept = ${concept}
        AND e.question_id IS NOT NULL
        AND e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
        AND ${rosterSql(scope)}
      GROUP BY 1, 2
      ORDER BY n DESC
      LIMIT 8
    `.catch(() => []),
  ])
  const st = (stats as NumRow[])[0]
  if (!st || n(st.sessions) === 0) return { concept, empty: true }
  const afterKnown = n(st.after_known)
  const indepKnown = n(st.indep_known)
  return {
    concept,
    empty: false,
    students: n(st.students),
    sessions: n(st.sessions),
    hintDepth: st.hint_depth != null ? Math.round(n(st.hint_depth) * 10) / 10 : null,
    avgAttempts: st.avg_attempts != null ? Math.round(n(st.avg_attempts) * 10) / 10 : null,
    successAfter: afterKnown >= 5 ? Math.round((n(st.after_ok) / afterKnown) * 100) : null,
    independentSuccess: indepKnown >= 5 ? Math.round((n(st.indep_ok) / indepKnown) * 100) : null,
    struggles: (struggles as NumRow[]).map((r) => ({ label: String(r.sub), students: n(r.students) })),
    questions: (questions as NumRow[]).map((r) => ({
      questionId: n(r.question_id),
      type: r.question_type != null ? String(r.question_type) : null,
      requests: n(r.n),
    })),
  }
}

async function loadCommonMistakes(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return []
  const codeRows = (await sql`
    SELECT cs.id, cs.student_id, s.full_name, cs.code, cs.submitted_at
    FROM codebench_submissions cs
    JOIN students s ON s.id = cs.student_id
    WHERE cs.submitted_at >= ${iso(scope.range.from)} AND cs.submitted_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    ORDER BY cs.submitted_at DESC
    LIMIT 200
  `.catch(() => [])) as NumRow[]

  const map = new Map<CodebenchMistakeKind, {
    students: Set<number>
    n: number
    examples: Array<{
      studentId: number
      studentName: string
      submissionId: number
      line: number
      snippet: string
      at: string | null
    }>
  }>()

  for (const r of codeRows) {
    const studentId = n(r.student_id)
    const studentName = String(r.full_name || "Student")
    const submissionId = n(r.id)
    const at = r.submitted_at != null ? String(r.submitted_at) : null
    for (const hit of scanCodebenchMistakes(String(r.code ?? ""))) {
      const rec = map.get(hit.kind) ?? { students: new Set<number>(), n: 0, examples: [] }
      rec.students.add(studentId)
      rec.n += 1
      if (rec.examples.length < 12) {
        rec.examples.push({
          studentId,
          studentName,
          submissionId,
          line: hit.line,
          snippet: hit.snippet,
          at,
        })
      }
      map.set(hit.kind, rec)
    }
  }

  return [...map.entries()]
    .map(([kind, rec]) => ({
      id: kind,
      label: CODEBENCH_MISTAKE_LABELS[kind],
      detail: CODEBENCH_MISTAKE_DETAIL[kind],
      students: rec.students.size,
      occurrences: rec.n,
      questions: 0,
      successAfter: null as number | null,
      trend: "stable" as const,
      empty: false,
      examples: rec.examples,
    }))
    .sort((a, b) => b.students - a.students || b.occurrences - a.occurrences)
}

async function loadTopicHeatmap(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return { weeks: [] as string[], rows: [] as Array<{ concept: string; cells: Array<{ week: string; intensity: number; students: number; requests: number; firstTry: number | null; after: number | null }> }> }
  const rows = (await sql`
    SELECT
      COALESCE(NULLIF(e.concept, ''), 'Course help') AS concept,
      date_trunc('week', e.occurred_at)::date AS week,
      COUNT(*)::int AS requests,
      COUNT(DISTINCT e.user_id)::int AS students,
      COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS after_ok,
      COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS after_known
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1, 2
    ORDER BY 2, 3 DESC
  `.catch(() => [])) as NumRow[]
  const weeks = [...new Set(rows.map((r) => String(r.week).slice(0, 10)))]
  const byConcept = new Map<string, NumRow[]>()
  for (const r of rows) {
    const c = String(r.concept)
    byConcept.set(c, [...(byConcept.get(c) ?? []), r])
  }
  const maxStudents = Math.max(1, ...rows.map((r) => n(r.students)))
  const mapped = [...byConcept.entries()].slice(0, 12).map(([concept, cells]) => ({
    concept,
    cells: weeks.map((week) => {
      const cell = cells.find((c) => String(c.week).slice(0, 10) === week)
      const students = n(cell?.students)
      return {
        week,
        intensity: students / maxStudents,
        students,
        requests: n(cell?.requests),
        firstTry: null as number | null,
        after: n(cell?.after_known) >= 5 ? Math.round((n(cell?.after_ok) / n(cell?.after_known)) * 100) : null,
      }
    }),
  }))
  return { weeks, rows: mapped }
}

export async function loadUsage(scope: FacultyInsightsScope) {
  const [categories, timeline, hourHeat, events] = await Promise.all([
    loadUsageCategories(scope),
    loadUsageTimeline(scope),
    loadHourHeatmap(scope),
    loadCourseEvents(scope),
  ])
  return { categories, timeline, hourHeat, events }
}

async function loadUsageCategories(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return { total: 0, slices: [] as Array<{ category: string; label: string; count: number; pct: number }> }
  const structured = (await sql`
    SELECT e.interaction_category AS category, COUNT(*)::int AS n
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1
    ORDER BY n DESC
  `.catch(() => [])) as NumRow[]
  if (structured.length > 0) {
    const total = structured.reduce((s, r) => s + n(r.n), 0)
    return {
      total,
      slices: structured.map((r) => {
        const category = String(r.category) as CoraInteractionCategory
        return {
          category,
          label: CATEGORY_LABELS[category] ?? category,
          count: n(r.n),
          pct: total ? Math.round((n(r.n) / total) * 100) : 0,
        }
      }),
    }
  }
  const usage = (await sql`
    SELECT e.feature, e.module, COUNT(*)::int AS n
    FROM cora_usage_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.user_role = 'student'
      AND e.created_at >= ${iso(scope.range.from)} AND e.created_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1, 2
  `.catch(() => [])) as NumRow[]
  const map = new Map<string, number>()
  for (const r of usage) {
    const cat = classifyInteractionCategory({ feature: String(r.feature ?? ""), module: String(r.module ?? "") })
    map.set(cat, (map.get(cat) ?? 0) + n(r.n))
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0)
  return {
    total,
    slices: [...map.entries()]
      .map(([category, count]) => ({
        category,
        label: CATEGORY_LABELS[category as CoraInteractionCategory] ?? category,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count),
  }
}

async function loadUsageTimeline(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return []
  const rows = (await sql`
    SELECT
      (e.occurred_at AT TIME ZONE 'America/Chicago')::date AS day,
      COUNT(*)::int AS interactions,
      COUNT(DISTINCT e.user_id)::int AS students,
      COUNT(*) FILTER (WHERE e.interaction_category = 'assessment_help')::int AS assessment_help,
      COUNT(*) FILTER (WHERE e.interaction_category = 'practice')::int AS practice_help
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1
    ORDER BY 1
  `.catch(() => [])) as NumRow[]
  if (rows.length > 0) {
    return fillTimelineDays(
      rows.map((r) => ({
        date: dayKey(r.day),
        interactions: n(r.interactions),
        students: n(r.students),
        debugging: 0,
        analysis: 0,
        planning: n(r.practice_help),
        other: Math.max(0, n(r.interactions) - n(r.assessment_help) - n(r.practice_help)),
      })),
      scope.range.from,
      scope.range.to,
    )
  }
  const usage = (await sql`
    SELECT (e.created_at AT TIME ZONE 'America/Chicago')::date AS day,
      COUNT(*)::int AS interactions,
      COUNT(DISTINCT e.user_id)::int AS students,
      COUNT(*) FILTER (
        WHERE e.feature IN ('CODE_DEBUG', 'CODE_HELP')
          OR e.module ILIKE '%debug%'
          OR e.module ILIKE '%error-spot%'
      )::int AS debugging,
      COUNT(*) FILTER (
        WHERE e.feature = 'ANALYTICS' OR e.module ILIKE '%analyze%'
      )::int AS analysis,
      COUNT(*) FILTER (
        WHERE e.feature = 'STUDY_PLAN' OR e.module ILIKE '%plan%'
      )::int AS planning
    FROM cora_usage_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.user_role = 'student'
      AND e.created_at >= ${iso(scope.range.from)} AND e.created_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1
    ORDER BY 1
  `.catch(() => [])) as NumRow[]
  return fillTimelineDays(
    usage.map((r) => {
      const interactions = n(r.interactions)
      const debugging = n(r.debugging)
      const analysis = n(r.analysis)
      const planning = n(r.planning)
      return {
        date: dayKey(r.day),
        interactions,
        students: n(r.students),
        debugging,
        analysis,
        planning,
        other: Math.max(0, interactions - debugging - analysis - planning),
      }
    }),
    scope.range.from,
    scope.range.to,
  )
}

async function loadHourHeatmap(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return []
  const rows = (await sql`
    SELECT EXTRACT(DOW FROM e.occurred_at AT TIME ZONE 'America/Chicago')::int AS dow,
           EXTRACT(HOUR FROM e.occurred_at AT TIME ZONE 'America/Chicago')::int AS hour,
           COUNT(*)::int AS n
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1, 2
  `.catch(() => [])) as NumRow[]
  const source = rows.length
    ? rows
    : ((await sql`
        SELECT EXTRACT(DOW FROM e.created_at AT TIME ZONE 'America/Chicago')::int AS dow,
               EXTRACT(HOUR FROM e.created_at AT TIME ZONE 'America/Chicago')::int AS hour,
               COUNT(*)::int AS n
        FROM cora_usage_events e
        JOIN students s ON s.id = e.user_id
        WHERE e.user_role = 'student'
          AND e.created_at >= ${iso(scope.range.from)} AND e.created_at <= ${iso(scope.range.to)}
          AND ${rosterSql(scope)}
        GROUP BY 1, 2
      `.catch(() => [])) as NumRow[])
  return source.map((r) => ({ dow: n(r.dow), hour: n(r.hour), count: n(r.n) }))
}

async function loadCourseEvents(scope: FacultyInsightsScope) {
  const rows = (await sql`
    SELECT q.id, q.title, q.assessment_type, q.available_from, q.available_until
    FROM quizzes q
    WHERE q.deleted_at IS NULL
      AND q.course_id = ${scope.courseId}
      AND COALESCE(q.available_from, q.available_until) >= ${iso(scope.range.from)}
      AND COALESCE(q.available_from, q.available_until) <= ${iso(scope.range.to)}
    ORDER BY COALESCE(q.available_from, q.available_until)
    LIMIT 20
  `.catch(() => [])) as NumRow[]
  return rows.map((r) => ({
    id: n(r.id),
    title: String(r.title ?? "Assessment"),
    type: String(r.assessment_type ?? "quiz"),
    at: String(r.available_from ?? r.available_until),
  }))
}

export async function loadAssistance(scope: FacultyInsightsScope) {
  const [outcomes, funnel, compare, dependence, integrity] = await Promise.all([
    loadAssistanceOutcomes(scope),
    loadFunnel(scope),
    loadAssistedVsIndependent(scope),
    loadDependence(scope),
    loadIntegrity(scope),
  ])
  return { outcomes, funnel, compare, dependence, integrity }
}

async function loadAssistanceOutcomes(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return []
  const rows = (await sql`
    SELECT
      CASE
        WHEN e.assistance_level <= 0 THEN 'No Cora'
        WHEN e.assistance_level <= 2 THEN 'Light Hint'
        WHEN e.assistance_level = 3 THEN 'Guided'
        ELSE 'Extensive'
      END AS bucket,
      COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS correct,
      COUNT(*) FILTER (WHERE e.correct_after IS FALSE)::int AS incorrect
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
      AND e.correct_after IS NOT NULL
    GROUP BY 1
  `.catch(() => [])) as NumRow[]
  const mapped = ["No Cora", "Light Hint", "Guided", "Extensive"].map((bucket) => {
    const r = rows.find((x) => String(x.bucket) === bucket)
    return { bucket, correct: n(r?.correct), incorrect: n(r?.incorrect), sessions: n(r?.correct) + n(r?.incorrect) }
  })
  if (mapped.some((b) => b.sessions > 0)) return mapped

  const usage = await loadUsageModuleRows(scope)
  const merged = new Map<string, { bucket: string; sessions: number; students: number }>()
  for (const r of usage) {
    const bucket = usageModuleLabel(String(r.module ?? ""), String(r.feature ?? ""))
    const prev = merged.get(bucket)
    merged.set(bucket, {
      bucket,
      sessions: (prev?.sessions ?? 0) + n(r.n),
      students: Math.max(prev?.students ?? 0, n(r.students)),
    })
  }
  return [...merged.values()]
    .sort((a, b) => b.sessions - a.sessions)
    .map((r) => ({ ...r, correct: 0, incorrect: 0, usageFallback: true }))
}

async function loadFunnel(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) {
    return { asked: 0, guided: 0, retried: 0, solved: 0, independent: 0 }
  }
  const rows = (await sql`
    SELECT
      COUNT(*)::int AS asked,
      COUNT(*) FILTER (WHERE e.assistance_level >= 1)::int AS guided,
      COUNT(*) FILTER (WHERE e.attempt_after IS NOT NULL OR e.correct_after IS NOT NULL)::int AS retried,
      COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS solved,
      COUNT(*) FILTER (WHERE e.independent_correct IS TRUE)::int AS independent
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
  `.catch(() => [])) as NumRow[]
  const r = rows[0] ?? {}
  if (n(r.asked) > 0) {
    return { asked: n(r.asked), guided: n(r.guided), retried: n(r.retried), solved: n(r.solved), independent: n(r.independent) }
  }
  const learning = (await sql`
    SELECT
      COUNT(*)::int AS asked,
      COUNT(*) FILTER (WHERE i.student_attempt_after_ai)::int AS retried,
      COUNT(*) FILTER (WHERE i.next_attempt_correct IS TRUE)::int AS solved
    FROM ai_learning_interactions i
    JOIN students s ON s.id = i.student_id
    WHERE i.created_at >= ${iso(scope.range.from)} AND i.created_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
  `.catch(() => [])) as NumRow[]
  const l = learning[0] ?? {}
  if (n(l.asked) > 0) {
    return { asked: n(l.asked), guided: n(l.asked), retried: n(l.retried), solved: n(l.solved), independent: 0 }
  }
  const usage = await loadUsageModuleRows(scope)
  const asked = usage.reduce((s, r) => s + n(r.n), 0)
  const guided = usage
    .filter((r) => /debug|error-spot|code_help|code_debug|improve|style/i.test(`${r.module ?? ""} ${r.feature ?? ""}`))
    .reduce((s, r) => s + n(r.n), 0)
  const planned = usage
    .filter((r) => /analyze|learning-plan|study_plan/i.test(`${r.module ?? ""} ${r.feature ?? ""}`))
    .reduce((s, r) => s + n(r.n), 0)
  const submitted = n(((await sql`
    SELECT COUNT(*)::int AS n
    FROM codebench_submissions cs
    JOIN students s ON s.id = cs.student_id
    WHERE cs.submitted_at >= ${iso(scope.range.from)}
      AND cs.submitted_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
  `.catch(() => [{ n: 0 }])) as NumRow[])[0]?.n)
  return { asked, guided, retried: planned, solved: submitted, independent: 0, usageFallback: true }
}

async function loadAssistedVsIndependent(scope: FacultyInsightsScope) {
  const concepts = await loadConceptBars(scope, 8)
  const scored = concepts.map((c) => ({
    concept: c.concept,
    coraAssisted: c.successAfter,
    independent: c.independentSuccess,
    sessions: c.requests,
  }))
  if (scored.some((c) => c.coraAssisted != null || c.independent != null)) return scored
  return scored.map((c) => ({ ...c, coraAssisted: c.sessions, independent: null }))
}

async function loadDependence(scope: FacultyInsightsScope) {
  if (scope.rosterIds.length === 0) return { label: "insufficient_evidence" as DependenceLabel, weeks: [] as Array<{ week: string; depth: number }> }
  const rows = (await sql`
    SELECT date_trunc('week', e.occurred_at)::date AS week,
           AVG(e.assistance_level)::float AS depth,
           COUNT(*)::int AS n
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(scope.range.from)} AND e.occurred_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
    GROUP BY 1
    ORDER BY 1
  `.catch(() => [])) as NumRow[]
  const weekKey = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(String(v))
    return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : String(v).slice(0, 10)
  }
  let weeks = rows.map((r) => ({ week: weekKey(r.week), depth: Math.round(n(r.depth) * 10) / 10, n: n(r.n) }))
  let usageFallback = false
  if (weeks.reduce((s, w) => s + w.n, 0) === 0) {
    const usageWeeks = (await sql`
      SELECT date_trunc('week', e.created_at)::date AS week, COUNT(*)::int AS n
      FROM cora_usage_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.user_role = 'student'
        AND e.created_at >= ${iso(scope.range.from)} AND e.created_at <= ${iso(scope.range.to)}
        AND ${rosterSql(scope)}
      GROUP BY 1
      ORDER BY 1
    `.catch(() => [])) as NumRow[]
    usageFallback = true
    weeks = usageWeeks.map((r) => ({
      week: weekKey(r.week),
      depth: Math.min(5, n(r.n) / 4),
      n: n(r.n),
    }))
  }
  if (weeks.length < 2 || weeks.reduce((s, w) => s + w.n, 0) < 6) {
    return { label: "insufficient_evidence" as DependenceLabel, weeks, note: weeks.length ? "Not enough weeks yet to call a trend." : "Not enough data yet", usageFallback }
  }
  const first = usageFallback ? weeks[0].n : weeks[0].depth
  const last = usageFallback ? weeks[weeks.length - 1].n : weeks[weeks.length - 1].depth
  const label: DependenceLabel = usageFallback
    ? last > first * 1.3 ? "high_assistance_need" : last < first * 0.7 ? "increasing_independence" : "stable_assistance"
    : last + 0.4 < first ? "increasing_independence" : last > first + 0.4 ? "high_assistance_need" : "stable_assistance"
  return {
    label,
    weeks,
    usageFallback,
    note: usageFallback
      ? label === "high_assistance_need"
        ? "Cora session volume is rising. See which tools students use most."
        : label === "increasing_independence"
          ? "Cora session volume is falling week over week."
          : "Weekly Cora session volume is relatively stable."
      : label === "increasing_independence"
        ? "Class is requiring less Cora assistance over time."
        : label === "high_assistance_need"
          ? "Average assistance depth is rising. Review the weakest concepts."
          : "Assistance depth is relatively stable.",
  }
}

async function loadIntegrity(scope: FacultyInsightsScope) {
  const rows = (await sql`
    SELECT
      e.assessment_id,
      e.assessment_type,
      COUNT(*)::int AS requests,
      COUNT(*) FILTER (WHERE e.assistance_category IN ('hint', 'guided'))::int AS hints,
      COUNT(*) FILTER (WHERE e.provided_conceptual_guidance)::int AS concepts,
      COUNT(*) FILTER (WHERE e.was_answer_seeking)::int AS seeking,
      COUNT(*) FILTER (WHERE e.answer_blocked)::int AS blocked,
      COUNT(*) FILTER (WHERE e.subsequent_correct IS TRUE)::int AS solved,
      COUNT(*) FILTER (WHERE e.subsequent_correct IS NOT NULL)::int AS known
    FROM cora_assessment_events e
    JOIN students s ON s.id = e.student_id
    WHERE e.created_at >= ${iso(scope.range.from)} AND e.created_at <= ${iso(scope.range.to)}
      AND ${rosterSql(scope)}
      AND (e.course_id IS NULL OR e.course_id = ${scope.courseId})
    GROUP BY 1, 2
    ORDER BY requests DESC
    LIMIT 12
  `.catch(() => [])) as NumRow[]
  return rows.map((r) => ({
    assessmentId: r.assessment_id != null ? n(r.assessment_id) : null,
    type: r.assessment_type != null ? String(r.assessment_type) : "Assessment",
    requests: n(r.requests),
    hints: n(r.hints),
    concepts: n(r.concepts),
    seeking: n(r.seeking),
    blocked: n(r.blocked),
    solvedPct: n(r.known) >= 5 ? Math.round((n(r.solved) / n(r.known)) * 100) : null,
  }))
}

function liveKindFromCategory(cat: string): "cora" | "assessment" | "practice" | "codebench" | "learning" {
  if (cat === "assessment_help") return "assessment"
  if (cat === "practice") return "practice"
  if (cat === "debugging" || cat === "code_understanding") return "codebench"
  if (cat === "lecture_clarification" || cat === "concept_explanation" || cat === "study_planning") return "learning"
  return "cora"
}

export async function loadLive(scope: FacultyInsightsScope, filter: string) {
  if (scope.rosterIds.length === 0) return { events: [], hotTopics: [], spikes: [] }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const rows = (await sql`
    SELECT e.occurred_at, e.user_id, s.full_name, e.interaction_category, e.concept,
           e.assessment_id, e.source, e.assistance_level, e.correct_after, e.answer_seeking_detected
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(since)}
      AND ${rosterSql(scope)}
    ORDER BY e.occurred_at DESC
    LIMIT 80
  `.catch(() => [])) as NumRow[]
  let events = rows.map((r) => ({
    at: String(r.occurred_at),
    studentId: n(r.user_id),
    student: String(r.full_name ?? "Student"),
    category: String(r.interaction_category),
    concept: String(r.concept ?? "Course help"),
    source: String(r.source ?? "cora"),
    summary: liveSummary(r),
    kind: liveKind(r),
  }))
  if (events.length === 0) {
    const usage = (await sql`
      SELECT e.created_at, e.user_id, s.full_name, e.feature, e.module
      FROM cora_usage_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.user_role = 'student' AND e.created_at >= ${iso(since)}
        AND ${rosterSql(scope)}
      ORDER BY e.created_at DESC
      LIMIT 40
    `.catch(() => [])) as NumRow[]
    events = usage.map((r) => {
      const feature = String(r.feature ?? "")
      const module = String(r.module ?? "")
      const category = classifyInteractionCategory({ feature, module })
      const tool = usageModuleLabel(module, feature)
      const student = String(r.full_name ?? "Student")
      return {
        at: String(r.created_at),
        studentId: n(r.user_id),
        student,
        category,
        concept: tool,
        source: "usage",
        summary: `${student} used ${tool}`,
        kind: liveKindFromCategory(category),
      }
    })
  }
  if (filter && filter !== "all") events = events.filter((e) => e.kind === filter)
  const [hotTopics, spikes] = await Promise.all([loadHotTopics(scope), loadSpikes(scope)])
  return { events, hotTopics, spikes }
}

function liveKind(r: NumRow): "cora" | "assessment" | "practice" | "codebench" | "learning" {
  const src = String(r.source ?? "")
  const cat = String(r.interaction_category ?? "")
  if (src === "assessment" || cat === "assessment_help") return "assessment"
  if (cat === "practice") return "practice"
  if (cat === "debugging" || cat === "code_understanding") return "codebench"
  if (cat === "lecture_clarification" || cat === "concept_explanation" || cat === "study_planning") return "learning"
  return "cora"
}

function liveSummary(r: NumRow) {
  const concept = String(r.concept ?? "a course topic")
  if (r.correct_after === true) return `Student solved a problem after Cora guidance · ${concept}`
  if (r.answer_seeking_detected) return `Answer-seeking request redirected · ${concept}`
  const level = n(r.assistance_level)
  if (level >= 4) return `Student requested extensive guided assistance · ${concept}`
  if (level >= 2) return `Student requested Cora guidance · ${concept}`
  return `Student asked Cora about ${concept}`
}

async function loadHotTopics(scope: FacultyInsightsScope) {
  const now = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const priorFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const [curr, prev] = await Promise.all([
    sql`
      SELECT e.concept, COUNT(*)::int AS n
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.occurred_at >= ${iso(now)} AND ${rosterSql(scope)}
      GROUP BY 1 ORDER BY n DESC LIMIT 8
    `.catch(() => []),
    sql`
      SELECT e.concept, COUNT(*)::int AS n
      FROM cora_interaction_events e
      JOIN students s ON s.id = e.user_id
      WHERE e.occurred_at >= ${iso(priorFrom)} AND e.occurred_at < ${iso(now)} AND ${rosterSql(scope)}
      GROUP BY 1
    `.catch(() => []),
  ])
  if ((curr as NumRow[]).length === 0) {
    const [usageCurr, usagePrev] = await Promise.all([
      sql`
        SELECT e.feature, e.module, COUNT(*)::int AS n
        FROM cora_usage_events e
        JOIN students s ON s.id = e.user_id
        WHERE e.user_role = 'student' AND e.created_at >= ${iso(now)} AND ${rosterSql(scope)}
        GROUP BY 1, 2 ORDER BY n DESC LIMIT 8
      `.catch(() => []),
      sql`
        SELECT e.feature, e.module, COUNT(*)::int AS n
        FROM cora_usage_events e
        JOIN students s ON s.id = e.user_id
        WHERE e.user_role = 'student' AND e.created_at >= ${iso(priorFrom)} AND e.created_at < ${iso(now)}
          AND ${rosterSql(scope)}
        GROUP BY 1, 2
      `.catch(() => []),
    ])
    const prevMap = new Map(
      (usagePrev as NumRow[]).map((r) => [`${r.feature}|${r.module}`, n(r.n)]),
    )
    return (usageCurr as NumRow[]).map((r) => {
      const requests = n(r.n)
      const before = prevMap.get(`${r.feature}|${r.module}`) ?? 0
      const change = before > 0 ? Math.round(((requests - before) / before) * 100) : requests > 0 ? 100 : 0
      return {
        concept: usageModuleLabel(String(r.module ?? ""), String(r.feature ?? "")),
        requests,
        change,
        state: change >= 25 ? "hot" : change <= -15 ? "cooling" : "stable",
      }
    })
  }
  const prevMap = new Map((prev as NumRow[]).map((r) => [String(r.concept), n(r.n)]))
  return (curr as NumRow[]).map((r) => {
    const requests = n(r.n)
    const before = prevMap.get(String(r.concept)) ?? 0
    const change = before > 0 ? Math.round(((requests - before) / before) * 100) : requests > 0 ? 100 : 0
    return {
      concept: String(r.concept ?? "Course help"),
      requests,
      change,
      state: change >= 25 ? "hot" : change <= -15 ? "cooling" : "stable",
    }
  })
}

async function loadSpikes(scope: FacultyInsightsScope) {
  const hour = new Date(Date.now() - 45 * 60 * 1000)
  const rows = (await sql`
    SELECT e.concept, COUNT(DISTINCT e.user_id)::int AS students, COUNT(*)::int AS requests
    FROM cora_interaction_events e
    JOIN students s ON s.id = e.user_id
    WHERE e.occurred_at >= ${iso(hour)} AND ${rosterSql(scope)}
    GROUP BY 1
    HAVING COUNT(DISTINCT e.user_id) >= 5
    ORDER BY students DESC
    LIMIT 4
  `.catch(() => [])) as NumRow[]
  return rows.map((r) => ({
    concept: String(r.concept),
    students: n(r.students),
    requests: n(r.requests),
    message: `${n(r.students)} students requested assistance in the last 45 minutes.`,
  }))
}

export async function loadPredictions(scope: FacultyInsightsScope) {
  const needs = await loadStudentNeeds(scope, 40)
  const predictions = needs.students
    .filter((s) => s.risk === "high" || s.risk === "medium")
    .slice(0, 12)
    .map((s) => {
      const features = s.evidence.split(" • ").filter(Boolean)
      const confidence = Math.min(92, 48 + features.length * 8 + (s.risk === "high" ? 12 : 0))
      if (features.length < 4 || confidence < 60) {
        return {
          studentId: s.id,
          name: s.name,
          prediction: "Support Need",
          level: s.risk,
          confidence: null as number | null,
          evidence: features,
          action: s.recommendedAction,
          ready: false,
          note: "Not enough data yet",
        }
      }
      return {
        studentId: s.id,
        name: s.name,
        prediction: "Support Need",
        level: s.risk,
        confidence,
        evidence: features,
        action: s.recommendedAction,
        ready: true,
        note: null,
      }
    })
  return { predictions, disclaimer: "Signals are observational. They are not grade forecasts and do not imply causation." }
}

function buildActionsFrom(
  concepts: Awaited<ReturnType<typeof loadConceptBars>>,
  students: Awaited<ReturnType<typeof loadStudentNeeds>>["students"],
) {
  const actions: Array<{
    id: string
    title: string
    detail: string
    href: string
    cta: string
    affected: number
  }> = []
  for (const c of concepts.slice(0, 3)) {
    if (c.students < 3) continue
    actions.push({
      id: `concept-${c.concept}`,
      title: `Review ${c.concept}`,
      detail: `${c.students} students affected · ${c.requests} Cora requests`,
      href: `/faculty/dashboard/content/practice?concept=${encodeURIComponent(c.concept)}`,
      cta: "Create Practice",
      affected: c.students,
    })
  }
  const flagged = students.filter((s) => s.risk === "high" || s.risk === "medium")
  if (flagged.length > 0) {
    actions.push({
      id: "check-in",
      title: `Check in with ${Math.min(flagged.length, 8)} students`,
      detail: "Repeated difficulty and/or declining scored performance",
      href: `/faculty/dashboard/management/students`,
      cta: "Review Students",
      affected: flagged.length,
    })
  }
  return actions.slice(0, 6)
}

export async function loadInterventions(scope: FacultyInsightsScope) {
  const [concepts, needs] = await Promise.all([loadConceptBars(scope, 6), loadStudentNeeds(scope, 40)])
  return buildActionsFrom(concepts, needs.students)
}

export async function loadStudentProfile(scope: FacultyInsightsScope, studentId: number) {
  const needs = await loadStudentNeeds({ ...scope, studentId }, 1)
  let student = needs.students[0]
  if (!student || student.id !== studentId) {
    const row = ((await sql`
      SELECT s.id, s.full_name, s.student_id AS code, s.section
      FROM students s
      WHERE s.id = ${studentId} AND s.deleted_at IS NULL
      LIMIT 1
    `.catch(() => [])) as NumRow[])[0]
    if (!row) return { empty: true }
    student = scoreStudentNeed({
      ...row,
      cora_sessions: 0,
      items: 0,
      no_gain: 0,
      seeking: 0,
      repeats: 0,
      missed: 0,
    })
  }
  const [structuredConcepts, usageConcepts, tutorConcepts, structuredTimeline, usageTimeline, structuredRecent, usageRecent, tutorRecent, dependence] =
    await Promise.all([
      sql`
        SELECT e.concept, COUNT(*)::int AS n, AVG(e.assistance_level)::float AS depth,
               COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS ok,
               COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS known
        FROM cora_interaction_events e
        WHERE e.user_id = ${studentId}
          AND e.occurred_at >= ${iso(scope.range.from)}
        GROUP BY 1 ORDER BY n DESC LIMIT 8
      `.catch(() => []),
      sql`
        SELECT COALESCE(NULLIF(e.module, ''), NULLIF(e.feature, ''), 'Course help') AS concept,
               COUNT(*)::int AS n
        FROM cora_usage_events e
        WHERE e.user_id = ${studentId} AND e.user_role = 'student'
          AND e.created_at >= ${iso(scope.range.from)}
        GROUP BY 1 ORDER BY n DESC LIMIT 8
      `.catch(() => []),
      sql`
        SELECT COALESCE(NULLIF(aic.topic, ''), 'Course help') AS concept, COUNT(*)::int AS n
        FROM ai_tutor_conversations aic
        WHERE aic.student_id = ${studentId}
          AND aic.created_at >= ${iso(scope.range.from)}
        GROUP BY 1 ORDER BY n DESC LIMIT 8
      `.catch(() => []),
      sql`
        SELECT date_trunc('week', e.occurred_at)::date AS week,
               COUNT(*)::int AS n,
               AVG(e.assistance_level)::float AS depth
        FROM cora_interaction_events e
        WHERE e.user_id = ${studentId}
          AND e.occurred_at >= ${iso(scope.range.from)}
        GROUP BY 1 ORDER BY 1
      `.catch(() => []),
      sql`
        SELECT date_trunc('week', e.created_at)::date AS week, COUNT(*)::int AS n
        FROM cora_usage_events e
        WHERE e.user_id = ${studentId} AND e.user_role = 'student'
          AND e.created_at >= ${iso(scope.range.from)}
        GROUP BY 1 ORDER BY 1
      `.catch(() => []),
      sql`
        SELECT e.occurred_at, e.interaction_category, e.concept, e.assistance_level, e.correct_after
        FROM cora_interaction_events e
        WHERE e.user_id = ${studentId}
        ORDER BY e.occurred_at DESC LIMIT 12
      `.catch(() => []),
      sql`
        SELECT e.created_at AS occurred_at, e.feature, e.module
        FROM cora_usage_events e
        WHERE e.user_id = ${studentId} AND e.user_role = 'student'
        ORDER BY e.created_at DESC LIMIT 12
      `.catch(() => []),
      sql`
        SELECT aic.created_at AS occurred_at, aic.topic AS concept
        FROM ai_tutor_conversations aic
        WHERE aic.student_id = ${studentId}
        ORDER BY aic.created_at DESC LIMIT 8
      `.catch(() => []),
      loadDependence({ ...scope, studentId }),
    ])

  const structured = (structuredConcepts as NumRow[]).filter((r) => r.concept)
  const conceptSource = structured.length
    ? structured
    : ([...(usageConcepts as NumRow[]), ...(tutorConcepts as NumRow[])]
        .reduce((map, r) => {
          const key = String(r.concept ?? "Course help")
          map.set(key, (map.get(key) ?? 0) + n(r.n))
          return map
        }, new Map<string, number>()))
  const conceptRows = Array.isArray(conceptSource)
    ? structured.map((r) => ({
        concept: String(r.concept),
        requests: n(r.n),
        depth: r.depth != null ? Math.round(n(r.depth) * 10) / 10 : null,
        successAfter: n(r.known) >= 3 ? Math.round((n(r.ok) / n(r.known)) * 100) : null,
      }))
    : [...conceptSource.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([concept, requests]) => ({ concept, requests, depth: null as number | null, successAfter: null as number | null }))

  const weeks = (structuredTimeline as NumRow[]).length
    ? (structuredTimeline as NumRow[])
    : (usageTimeline as NumRow[])

  const recentRows = (structuredRecent as NumRow[]).length
    ? (structuredRecent as NumRow[])
    : ([...(usageRecent as NumRow[]), ...(tutorRecent as NumRow[])]
        .sort((a, b) => new Date(String(b.occurred_at)).getTime() - new Date(String(a.occurred_at)).getTime())
        .slice(0, 12))

  return {
    empty: false,
    student,
    concepts: conceptRows,
    timeline: weeks.map((r) => ({
      week: String(r.week).slice(0, 10),
      requests: n(r.n),
      depth: r.depth != null ? Math.round(n(r.depth) * 10) / 10 : null,
      label: n(r.depth) >= 4 ? "Heavy Cora assistance" : n(r.n) >= 4 ? "Frequent help" : "Light activity",
    })),
    recent: recentRows.map((r) => ({
      at: String(r.occurred_at),
      summary: r.feature || r.module
        ? `Used Cora · ${String(r.module || r.feature || "session")}`
        : liveSummary(r),
    })),
    dependence,
    actions: [
      { label: "Assign targeted practice", href: null },
      { label: "Open student record", href: `/faculty/dashboard/management/students/${studentId}` },
    ],
  }
}

