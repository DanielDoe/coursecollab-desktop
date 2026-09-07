import { sql } from "@/lib/db"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import { END_GOAL_QUESTIONS } from "@/lib/institutions/research/end-goal-questions"
import { prettyInsightLabel, type InstitutionNamedCount } from "@/lib/institutions/insights"
import { formatWeekLabel, parsePgDateOnly } from "@/lib/institutions/metrics/scope"
import { getBehavioralIndicators, getInterventionAnalytics, getTransferAnalytics } from "@/lib/institutions/metrics/phase3"
import { getDelayedTransferWindows, getLearningPathways } from "@/lib/institutions/metrics/phase5"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"
import { workflowAssistanceProxy } from "@/lib/institutions/metrics/phase2"

export type EndGoalStatus = "answered" | "partial" | "insufficient"

export type EndGoalAnswer = {
  id: string
  question: string
  status: EndGoalStatus
  evidence: "descriptive" | "derived" | "inferred" | "research_outcome"
  headline: string | null
  detail: string
  series: InstitutionNamedCount[]
  unblock?: string
}

function first(rows: unknown): Record<string, unknown> {
  return (Array.isArray(rows) && rows[0] ? (rows[0] as Record<string, unknown>) : {}) ?? {}
}

function num(row: Record<string, unknown>, key: string): number {
  return Number(row[key] ?? 0)
}

function namedRows(rows: unknown, nameKey = "name", valueKey = "value"): InstitutionNamedCount[] {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    const r = row as Record<string, unknown>
    const key = String(r[nameKey] ?? r.key ?? "other")
    return { key, name: prettyInsightLabel(key), value: Number(r[valueKey] ?? r.n ?? 0) }
  })
}

export async function getEndGoalAnswers(scope: InstitutionScope, institutionId: number): Promise<EndGoalAnswer[]> {
  const empty = (id: string, question: string, detail: string, unblock: string, evidence: EndGoalAnswer["evidence"] = "research_outcome"): EndGoalAnswer => ({
    id,
    question,
    status: "insufficient",
    evidence,
    headline: null,
    detail,
    series: [],
    unblock,
  })

  if (scope.courseIds.length === 0) {
    return END_GOAL_QUESTIONS.map((q) => empty(q.id, q.question, "No license-covered courses in scope.", "Cover courses on the institution license."))
  }

  const [
    frequency,
    purpose,
    weekly,
    deadlines,
    feedback,
    courses,
    proximate,
    hardAfter,
    depth,
    behavior,
    transfer,
    delayed,
    pathways,
    interventions,
  ] = await Promise.all([
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL) AS roster,
        COUNT(*)::int AS sessions,
        COUNT(DISTINCT u.user_id)::int AS students
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
    `.catch(() => [{ roster: 0, sessions: 0, students: 0 }]),
    sql`
      SELECT COALESCE(NULLIF(TRIM(workflow_type), ''), 'unknown') AS name, COUNT(*)::int AS value
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    `.catch(() => []),
    sql`
      SELECT date_trunc('week', u.created_at)::date AS week, COUNT(*)::int AS value
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      GROUP BY 1 ORDER BY 1
    `.catch(() => []),
    sql`
      WITH due AS (
        SELECT q.id, q.available_until
        FROM quizzes q
        WHERE q.course_id = ANY(${scope.courseIds}) AND q.available_until IS NOT NULL
      )
      SELECT
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM due d
            WHERE u.created_at >= d.available_until - INTERVAL '48 hours'
              AND u.created_at <= d.available_until
          )
        )::int AS near,
        COUNT(*)::int AS all_sessions
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
    `.catch(() => [{ near: 0, all_sessions: 0 }]),
    sql`
      SELECT
        COUNT(*)::int AS n,
        ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)) / 60.0
        ))::numeric, 1) AS median_min
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND qa.deleted_at IS NULL AND qa.started_at IS NOT NULL AND qa.completed_at IS NOT NULL
        AND qa.completed_at > qa.started_at
        AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
    `.catch(() => [{ n: 0, median_min: null }]),
    sql`
      SELECT c.id::text AS key, COALESCE(NULLIF(c.code, ''), c.name, 'Course') AS name,
        COUNT(DISTINCT u.user_id)::int AS value
      FROM courses c
      JOIN students st ON st.course_id = c.id AND st.deleted_at IS NULL
      LEFT JOIN institution_cora_usage u ON u.user_id = st.id AND u.user_type = 'student'
        AND u.institution_id = ${institutionId}
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      WHERE c.id = ANY(${scope.courseIds})
      GROUP BY c.id, c.code, c.name
      HAVING COUNT(DISTINCT st.id) >= ${MIN_CELL_SIZE}
      ORDER BY value DESC
    `.catch(() => []),
    sql`
      SELECT COALESCE(NULLIF(TRIM(qb.topic), ''), 'Untagged') AS name, COUNT(*)::int AS value
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      JOIN practice_attempts pa ON pa.student_id = st.id
        AND ABS(EXTRACT(EPOCH FROM (COALESCE(pa.completed_at, pa.started_at) - u.created_at))) <= 86400
      JOIN practice_answers pans ON pans.attempt_id = pa.id
      JOIN question_bank qb ON qb.id = pans.bank_question_id
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    `.catch(() => []),
    sql`
      SELECT COALESCE(NULLIF(TRIM(qb.topic), ''), 'Untagged') AS name,
        COUNT(*)::int AS n,
        ROUND(AVG(CASE WHEN pans.is_correct THEN 100.0 ELSE 0 END)::numeric, 1) AS acc
      FROM institution_cora_usage u
      JOIN students st ON st.id = u.user_id AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
      JOIN practice_attempts pa ON pa.student_id = st.id
        AND COALESCE(pa.completed_at, pa.started_at) > u.created_at
        AND COALESCE(pa.completed_at, pa.started_at) <= u.created_at + INTERVAL '7 days'
      JOIN practice_answers pans ON pans.attempt_id = pa.id
      JOIN question_bank qb ON qb.id = pans.bank_question_id
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
      GROUP BY 1
      HAVING COUNT(*) >= ${MIN_CELL_SIZE}
      ORDER BY acc ASC NULLS LAST
      LIMIT 8
    `.catch(() => []),
    sql`
      SELECT ROUND(AVG(n)::numeric, 1) AS avg_events, COUNT(*)::int AS sessions
      FROM (
        SELECT e.usage_id, COUNT(*)::int AS n
        FROM cora_usage_events e
        JOIN institution_cora_usage u ON u.id = e.usage_id
        WHERE u.institution_id = ${institutionId}
          AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
        GROUP BY 1
      ) s
    `.catch(() => [{ avg_events: null, sessions: 0 }]),
    getBehavioralIndicators(scope, institutionId),
    getTransferAnalytics(scope, institutionId),
    getDelayedTransferWindows(scope, institutionId),
    getLearningPathways(scope, institutionId),
    getInterventionAnalytics(scope, institutionId),
  ])

  const freq = first(frequency)
  const roster = num(freq, "roster")
  const sessions = num(freq, "sessions")
  const aiStudents = num(freq, "students")
  const due = first(deadlines)
  const near = num(due, "near")
  const allSess = num(due, "all_sessions")
  const fb = first(feedback)
  const depthRow = first(depth)
  const purposeSeries = namedRows(purpose).map((row) => ({
    ...row,
    name: workflowAssistanceProxy(row.key),
    key: workflowAssistanceProxy(row.key),
  }))
  const purposeMerged = Object.values(
    purposeSeries.reduce<Record<string, InstitutionNamedCount>>((acc, row) => {
      const cur = acc[row.key] ?? { key: row.key, name: row.name, value: 0 }
      cur.value += row.value
      acc[row.key] = cur
      return acc
    }, {}),
  ).sort((a, b) => b.value - a.value)

  const weekSeries = (Array.isArray(weekly) ? weekly : []).map((row) => {
    const r = row as Record<string, unknown>
    const week = parsePgDateOnly(r.week)
    return { key: week, name: formatWeekLabel(week), value: Number(r.value ?? 0) }
  })
  const proximateSeries = namedRows(proximate)
  const hardSeries = (Array.isArray(hardAfter) ? hardAfter : []).map((row) => {
    const r = row as Record<string, unknown>
    return { key: String(r.name), name: String(r.name), value: Number(r.acc ?? 0) }
  })
  const courseSeries = namedRows(courses)

  const byId: Record<string, EndGoalAnswer> = {
    ai_frequency: {
      id: "ai_frequency",
      question: END_GOAL_QUESTIONS[0].question,
      status: sessions > 0 ? "answered" : "insufficient",
      evidence: "descriptive",
      headline: sessions > 0 ? `${aiStudents.toLocaleString()} students · ${sessions.toLocaleString()} sessions` : null,
      detail:
        sessions > 0
          ? `${roster > 0 ? Math.round((aiStudents / roster) * 1000) / 10 : 0}% of the covered roster used Cora in this window. This is usage frequency, not learning.`
          : "No student Cora sessions in the selected window.",
      series: [],
      unblock: sessions > 0 ? undefined : "Cora usage rows populate this answer.",
    },
    ai_purpose: {
      id: "ai_purpose",
      question: END_GOAL_QUESTIONS[1].question,
      status: purposeMerged.length > 0 ? "partial" : "insufficient",
      evidence: "inferred",
      headline: purposeMerged[0] ? `Most common proxy: ${purposeMerged[0].name}` : null,
      detail: "Workflow type is a product label mapped to a coarse assistance proxy. It is not a validated assistance taxonomy.",
      series: purposeMerged,
      unblock: purposeMerged.length ? undefined : "Need Cora rows with workflow_type.",
    },
    concepts_ai: {
      id: "concepts_ai",
      question: END_GOAL_QUESTIONS[2].question,
      status: proximateSeries.some((r) => r.key !== "Untagged" && r.value > 0) ? "partial" : "insufficient",
      evidence: "inferred",
      headline: proximateSeries[0] ? `Most proximate topic: ${proximateSeries[0].name}` : null,
      detail: "Topics are practice items within 24 hours of a Cora session. Cora turns are not tagged with a concept, so this is proximity, not an assistance-request count.",
      series: proximateSeries,
      unblock: "Store a concept or item id on each Cora turn to count assistance requests by concept.",
    },
    attempt_before: {
      id: "attempt_before",
      question: END_GOAL_QUESTIONS[3].question,
      status: behavior.windowN > 0 ? "partial" : "insufficient",
      evidence: "derived",
      headline:
        behavior.attemptBeforeAiRate != null ? `${behavior.attemptBeforeAiRate}% of Cora sessions had practice in the prior 24h` : null,
      detail: `${behavior.note} Same-problem escalation is not measured.`,
      series: behavior.patterns,
      unblock: behavior.windowN > 0 ? undefined : "Need Cora sessions and practice timestamps.",
    },
    assistance_depth: {
      id: "assistance_depth",
      question: END_GOAL_QUESTIONS[4].question,
      status: num(depthRow, "sessions") >= MIN_CELL_SIZE && depthRow.avg_events != null ? "partial" : "insufficient",
      evidence: "inferred",
      headline:
        depthRow.avg_events != null && num(depthRow, "sessions") >= MIN_CELL_SIZE
          ? `${depthRow.avg_events} events per Cora usage row`
          : null,
      detail: "Event count is not assistance depth or 'help until success'. Turn-level depth (0–5) is not stored.",
      series: [],
      unblock: "Store turn-level assistance depth and a success criterion on the same item.",
    },
    persist_without_ai: {
      id: "persist_without_ai",
      question: END_GOAL_QUESTIONS[5].question,
      status: transfer.available ? "partial" : "insufficient",
      evidence: "derived",
      headline: transfer.available && transfer.transferScore != null ? `Next independent (≤14d): ${transfer.transferScore}%` : null,
      detail: `${transfer.associationNote} Delayed windows: ${delayed.transferWindows.map((w) => `${w.label} n=${w.n}`).join(" · ")}.`,
      series: delayed.transferWindows.map((w) => ({ key: w.key, name: w.label, value: w.n })),
      unblock: transfer.unblock,
    },
    strategies_independent: empty(
      "strategies_independent",
      END_GOAL_QUESTIONS[6].question,
      "Assistance strategy (hint, scaffold, worked solution) is not stored, and independent checks are untagged.",
      "Log strategy on each Cora turn and tag later assessments as independent. Do not treat workflow_type as strategy.",
      "research_outcome",
    ),
    hints_vs_solutions: empty(
      "hints_vs_solutions",
      END_GOAL_QUESTIONS[7].question,
      "Hint versus worked-solution requests are not instrumented.",
      "Record request type (hint / solution / explanation) on the Cora turn before comparing behavior.",
      "research_outcome",
    ),
    usage_over_term: {
      id: "usage_over_term",
      question: END_GOAL_QUESTIONS[8].question,
      status: weekSeries.some((w) => w.value > 0) ? "answered" : "insufficient",
      evidence: "descriptive",
      headline: weekSeries.length ? `${weekSeries.reduce((s, w) => s + w.value, 0)} sessions across ${weekSeries.length} weeks` : null,
      detail: "Weekly Cora session counts. This is usage over time, not a learning trajectory.",
      series: weekSeries,
    },
    near_deadlines: {
      id: "near_deadlines",
      question: END_GOAL_QUESTIONS[9].question,
      status: allSess > 0 ? "partial" : "insufficient",
      evidence: "derived",
      headline: allSess > 0 ? `${near} of ${allSess} Cora sessions fell within 48h of a quiz available_until` : null,
      detail: "Deadline proximity uses quizzes.available_until. It is an association with due dates, not a claim that deadlines cause AI use.",
      series:
        allSess > 0
          ? [
              { key: "near", name: "Within 48h of a due date", value: near },
              { key: "other", name: "Other sessions", value: Math.max(0, allSess - near) },
            ]
          : [],
      unblock: allSess > 0 ? undefined : "Need Cora sessions and quizzes.available_until.",
    },
    intervention_who: {
      id: "intervention_who",
      question: END_GOAL_QUESTIONS[10].question,
      status: interventions.available ? "partial" : "insufficient",
      evidence: "descriptive",
      headline: interventions.available ? `${interventions.engaged} engaged of ${interventions.triggered} triggered` : null,
      detail: "Counts who reached each funnel step. Individual names are not shown. Outcome change is not inferred.",
      series: interventions.funnel,
      unblock: interventions.unblock,
    },
    intervention_after: empty(
      "intervention_after",
      END_GOAL_QUESTIONS[11].question,
      "No post-intervention outcome window is computed until intervention rows exist and a later observation is linked.",
      "Write institution_interventions, then join the next practice or independent check after engaged_at.",
      "derived",
    ),
    hard_after_ai: {
      id: "hard_after_ai",
      question: END_GOAL_QUESTIONS[12].question,
      status: hardSeries.length > 0 ? "partial" : "insufficient",
      evidence: "derived",
      headline: hardSeries[0] ? `Lowest post-Cora practice accuracy: ${hardSeries[0].name} (${hardSeries[0].value}%)` : null,
      detail: "Accuracy on practice answers in the 7 days after a Cora session, by question_bank.topic. Same-item persistence is not shown. Not an AI effect.",
      series: hardSeries,
      unblock: hardSeries.length ? undefined : "Need topic-tagged practice after Cora, with N ≥ 10 per topic.",
    },
    time_to_feedback: {
      id: "time_to_feedback",
      question: END_GOAL_QUESTIONS[13].question,
      status: num(fb, "n") >= MIN_CELL_SIZE && fb.median_min != null ? "answered" : "insufficient",
      evidence: "derived",
      headline: fb.median_min != null && num(fb, "n") >= MIN_CELL_SIZE ? `Median ${fb.median_min} minutes from start to completed attempt` : null,
      detail: "This is attempt duration on completed quizzes (started_at → completed_at). It is a proxy for when automated scoring can exist, not instructor comment latency.",
      series: [],
      unblock: "Store a distinct feedback_at if you need time-to-feedback separate from attempt duration.",
    },
    pathways_independent: {
      id: "pathways_independent",
      question: END_GOAL_QUESTIONS[14].question,
      status: pathways.paths.length > 0 ? "partial" : "insufficient",
      evidence: "derived",
      headline: pathways.paths[0] ? `Most common first-three path: ${pathways.paths[0].name}` : null,
      detail: `${pathways.note} Paths are not yet conditioned on a later independent-tagged success. ${pathways.suppressedStudents} students sit in paths below the cell minimum.`,
      series: pathways.paths,
      unblock: "Tag independent checks, then restrict pathways to learners with a later independent score.",
    },
    vary_courses: {
      id: "vary_courses",
      question: END_GOAL_QUESTIONS[15].question,
      status: courseSeries.length > 0 ? "partial" : "insufficient",
      evidence: "descriptive",
      headline: courseSeries[0] ? `Highest Cora headcount: ${courseSeries[0].name}` : null,
      detail: "Cora-using students by course, shown only when the course roster is at least the cell minimum. Demographic cohorts stay hidden without authorized attributes.",
      series: courseSeries,
      unblock: courseSeries.length ? "Use Research → studies to compare configured cohorts." : "Need at least one course with N ≥ 10.",
    },
    export_evidence: {
      id: "export_evidence",
      question: END_GOAL_QUESTIONS[16].question,
      status: "answered",
      evidence: "descriptive",
      headline: "De-identified summary, outcomes, and mixed-effects panel CSVs",
      detail: "Research → exports. Rows use research_student_id (rs_…). Names and emails are never included. CourseCollab does not run confirmatory models on export.",
      series: [],
    },
  }

  return END_GOAL_QUESTIONS.map((q) => byId[q.id] ?? empty(q.id, q.question, "Not computed.", "See Data Quality."))
}
