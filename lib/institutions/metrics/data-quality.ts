import { sql } from "@/lib/db"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export type DataQualityCoverage = {
  label: string
  percent: number | null
  numerator: number
  denominator: number
  note: string
}

export type InstitutionDataQuality = {
  cellMinimum: number
  coverages: DataQualityCoverage[]
  warnings: string[]
}

function pct(n: number, d: number): number | null {
  if (d <= 0) return null
  return Math.round((n / d) * 1000) / 10
}

function coverage(label: string, numerator: number, denominator: number, note: string): DataQualityCoverage {
  return { label, percent: pct(numerator, denominator), numerator, denominator, note }
}

export async function getInstitutionDataQuality(scope: InstitutionScope): Promise<InstitutionDataQuality> {
  if (scope.courseIds.length === 0) {
    return {
      cellMinimum: MIN_CELL_SIZE,
      coverages: [],
      warnings: ["No license-covered courses in scope. Coverage cannot be computed."],
    }
  }

  const [roster, quizUsers, practiceUsers, coraUsers, questions, tagged, coraRows, classified, aiInteractions, events, policyTags] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM students WHERE course_id = ANY(${scope.courseIds}) AND deleted_at IS NULL`,
    sql`
      SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
      JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(qa.started_at, qa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(qa.started_at, qa.completed_at)::date <= ${scope.to}::date
    `,
    sql`
      SELECT COUNT(DISTINCT st.id)::int AS n FROM students st
      JOIN practice_attempts pa ON pa.student_id = st.id
      WHERE st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
        AND COALESCE(pa.started_at, pa.completed_at)::date >= ${scope.from}::date
        AND COALESCE(pa.started_at, pa.completed_at)::date <= ${scope.to}::date
    `,
    sql`
      SELECT COUNT(DISTINCT u.user_id)::int AS n FROM institution_cora_usage u
      WHERE u.institution_id = ${scope.institutionId} AND u.user_type = 'student'
        AND u.created_at::date >= ${scope.from}::date AND u.created_at::date <= ${scope.to}::date
        AND (u.course_id IS NULL OR u.course_id = ANY(${scope.courseIds}))
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      WHERE q.course_id = ANY(${scope.courseIds})
    `.catch(() => [{ n: 0 }]),
    sql`
      SELECT COUNT(*)::int AS n FROM question_bank qb
      WHERE qb.course_id = ANY(${scope.courseIds}) AND NULLIF(TRIM(qb.topic), '') IS NOT NULL
    `.catch(() => [{ n: 0 }]),
    sql`
      SELECT COUNT(*)::int AS n FROM institution_cora_usage
      WHERE institution_id = ${scope.institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM institution_cora_usage
      WHERE institution_id = ${scope.institutionId}
        AND created_at::date >= ${scope.from}::date AND created_at::date <= ${scope.to}::date
        AND NULLIF(TRIM(workflow_type), '') IS NOT NULL
    `,
    sql`SELECT COUNT(*)::int AS n FROM ai_learning_interactions WHERE institution_id = ${scope.institutionId}`.catch(() => [{ n: 0 }]),
    sql`SELECT COUNT(*)::int AS n FROM analytics_events WHERE institution_id = ${scope.institutionId}`.catch(() => [{ n: 0 }]),
    sql`
      SELECT
        COUNT(*) FILTER (WHERE q.ai_policy IS NOT NULL AND TRIM(q.ai_policy) <> '')::int AS tagged,
        COUNT(*)::int AS n
      FROM quizzes q
      WHERE q.course_id = ANY(${scope.courseIds})
    `.catch(() => [{ tagged: 0, n: 0 }]),
  ])

  const bankTotal = await sql`
    SELECT COUNT(*)::int AS n FROM question_bank WHERE course_id = ANY(${scope.courseIds})
  `.catch(() => [{ n: 0 }])

  const covered = Number(roster[0]?.n ?? 0)
  const quizN = Number(quizUsers[0]?.n ?? 0)
  const practiceN = Number(practiceUsers[0]?.n ?? 0)
  const coraN = Number(coraUsers[0]?.n ?? 0)
  const qN = Number(questions[0]?.n ?? 0)
  const taggedN = Number(tagged[0]?.n ?? 0)
  const bankN = Number(bankTotal[0]?.n ?? 0)
  const coraAll = Number(coraRows[0]?.n ?? 0)
  const coraClassified = Number(classified[0]?.n ?? 0)
  const aiInteractionN = Number(aiInteractions[0]?.n ?? 0)
  const eventN = Number(events[0]?.n ?? 0)
  const policyTaggedN = Number(policyTags[0]?.tagged ?? 0)
  const quizTotalN = Number(policyTags[0]?.n ?? qN)

  const coverages = [
    coverage("Roster with assessment activity", quizN, covered, "Students with at least one quiz attempt in range."),
    coverage("Roster with practice activity", practiceN, covered, "Students with at least one practice attempt in range."),
    coverage("Roster with Cora activity", coraN, covered, "Students with at least one institutional Cora usage row."),
    coverage("Question bank topic tagging", taggedN, bankN, "question_bank.topic is the only concept tag available today."),
    coverage("Cora rows with workflow type", coraClassified, coraAll, "Workflow type ≠ assistance taxonomy. Classification coverage is not AI-intent coverage."),
    coverage("AI interaction classification", aiInteractionN, Math.max(1, coraAll), "Inferred assistance type + depth from ai_learning_interactions."),
    coverage("Independent assessment tagging", policyTaggedN, quizTotalN, "quizzes.ai_policy must be AI_RESTRICTED, AI_UNAVAILABLE, or INDEPENDENT_CHECK for independent scores."),
    coverage("Analytics event stream", eventN, Math.max(1, coraAll + quizN + practiceN), "Standardized analytics_events from product instrumentation."),
    coverage("AI → outcome linkage", aiInteractionN, Math.max(1, coraN), "Outcome backfill uses subsequent practice attempts when available."),
  ]

  const warnings: string[] = []
  if (covered < MIN_CELL_SIZE) warnings.push(`Covered roster N=${covered} is below the default cell minimum (${MIN_CELL_SIZE}). Subgroup splits are suppressed.`)
  if ((coverages[3]?.percent ?? 0) < 50) warnings.push("Concept analytics will be incomplete until more question_bank topics are tagged.")
  if ((coverages[5]?.percent ?? 0) === 0) warnings.push("Independent performance and transfer scores cannot be computed until assessments carry an AI policy tag.")
  if (eventN === 0) warnings.push("Standardized analytics_events are still sparse. Legacy source tables remain in use for some metrics.")
  else warnings.push("Overview KPIs prefer analytics_events when volume is sufficient; legacy tables remain as fallback.")
  if (aiInteractionN === 0) warnings.push("AI interaction classification will populate as students use Cora on institution-covered courses.")

  return { cellMinimum: MIN_CELL_SIZE, coverages, warnings }
}
