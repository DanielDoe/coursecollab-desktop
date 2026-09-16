import { sql } from "@/lib/db"
import { ensureCoraInsightsSchema } from "@/lib/cora/insights/schema"
import { DEPENDENCE_COPY, type DependenceLabel } from "@/lib/cora/insights/taxonomy"

function n(v: unknown) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

/** Privacy-appropriate student self view. No peer comparison. */
export async function loadStudentCoraInsights(studentId: number) {
  await ensureCoraInsightsSchema().catch(() => undefined)
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [topics, weeks, recent] = await Promise.all([
    sql`
      SELECT e.concept, COUNT(*)::int AS n,
             AVG(e.assistance_level)::float AS depth,
             COUNT(*) FILTER (WHERE e.correct_after IS TRUE)::int AS ok,
             COUNT(*) FILTER (WHERE e.correct_after IS NOT NULL)::int AS known,
             COUNT(*) FILTER (WHERE e.independent_correct IS TRUE)::int AS indep_ok,
             COUNT(*) FILTER (WHERE e.independent_correct IS NOT NULL)::int AS indep_known
      FROM cora_interaction_events e
      WHERE e.user_id = ${studentId} AND e.occurred_at >= ${from.toISOString()}
      GROUP BY 1
      ORDER BY n DESC
      LIMIT 8
    `.catch(() => []),
    sql`
      SELECT date_trunc('week', e.occurred_at)::date AS week,
             COUNT(*)::int AS n,
             AVG(e.assistance_level)::float AS depth
      FROM cora_interaction_events e
      WHERE e.user_id = ${studentId} AND e.occurred_at >= ${from.toISOString()}
      GROUP BY 1 ORDER BY 1
    `.catch(() => []),
    sql`
      SELECT e.occurred_at, e.concept, e.interaction_category
      FROM cora_interaction_events e
      WHERE e.user_id = ${studentId}
      ORDER BY e.occurred_at DESC LIMIT 8
    `.catch(() => []),
  ])

  const topicRows = (topics as Array<Record<string, unknown>>).map((r) => ({
    topic: String(r.concept ?? "Course help"),
    requests: n(r.n),
    depth: r.depth != null ? Math.round(n(r.depth) * 10) / 10 : null,
    improving: n(r.known) >= 3 && n(r.ok) / n(r.known) >= 0.65,
    needsPractice: n(r.indep_known) >= 3 && n(r.indep_ok) / n(r.indep_known) < 0.55,
  }))

  const weekRows = (weeks as Array<Record<string, unknown>>).map((r) => ({
    week: String(r.week).slice(0, 10),
    requests: n(r.n),
    depth: Math.round(n(r.depth) * 10) / 10,
  }))

  let dependence: DependenceLabel = "insufficient_evidence"
  if (weekRows.length >= 2 && weekRows.reduce((s, w) => s + w.requests, 0) >= 6) {
    const first = weekRows[0].depth
    const last = weekRows[weekRows.length - 1].depth
    dependence = last + 0.4 < first ? "increasing_independence" : last > first + 0.4 ? "high_assistance_need" : "stable_assistance"
  }

  const improving = topicRows.filter((t) => t.improving).map((t) => t.topic)
  const practice = topicRows.filter((t) => t.needsPractice).map((t) => t.topic)
  const askedMost = topicRows.slice(0, 3).map((t) => t.topic)

  let summary = "Not enough data yet to describe your recent work with Cora."
  if (askedMost.length) {
    const next = practice[0] ?? topicRows[0]?.topic
    const win = improving[0]
    summary = win
      ? `You've improved substantially with ${win}. Your next priority should be ${next}, where you currently require more guided assistance.`
      : `You've been asking Cora most about ${askedMost.join(", ")}. Focus practice on ${next} to build independence.`
  }

  return {
    summary,
    askedMost,
    improving,
    needsPractice: practice,
    guidance: DEPENDENCE_COPY[dependence],
    weeks: weekRows,
    recent: (recent as Array<Record<string, unknown>>).map((r) => ({
      at: String(r.occurred_at),
      topic: String(r.concept ?? "Course help"),
    })),
    empty: topicRows.length === 0,
  }
}
