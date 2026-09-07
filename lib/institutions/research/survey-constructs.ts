import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export const SURVEY_CONSTRUCTS = [
  "cognitive_engagement",
  "self_regulated_learning",
  "ai_trust",
  "cognitive_load",
] as const

export type SurveyConstruct = (typeof SURVEY_CONSTRUCTS)[number]

export type SurveyConstructAnalytics = {
  available: boolean
  instruments: number
  responses: number
  byConstruct: InstitutionNamedCount[]
  note: string
}

export async function upsertSurveyInstrument(input: {
  institutionId: number
  name: string
  construct: SurveyConstruct
  scaleMin?: number
  scaleMax?: number
  itemCount?: number
  sourceCitation?: string
}): Promise<number> {
  await ensureInstitutionSchema()
  const rows = (await sql`
    INSERT INTO institution_survey_instruments (
      institution_id, name, construct, scale_min, scale_max, item_count, source_citation
    ) VALUES (
      ${input.institutionId},
      ${input.name.slice(0, 200)},
      ${input.construct},
      ${input.scaleMin ?? 1},
      ${input.scaleMax ?? 5},
      ${input.itemCount ?? 0},
      ${input.sourceCitation ?? null}
    )
    RETURNING id
  `) as Array<{ id: number }>
  return Number(rows[0]?.id ?? 0)
}

export async function importSurveyResponses(input: {
  institutionId: number
  instrumentId: number
  responses: Array<{ studentId: number; courseId?: number | null; totalScore: number }>
}): Promise<number> {
  await ensureInstitutionSchema()
  let n = 0
  for (const row of input.responses) {
    if (!Number.isFinite(row.studentId) || row.studentId <= 0) continue
    await sql`
      INSERT INTO institution_survey_responses (
        instrument_id, institution_id, student_id, course_id, total_score
      ) VALUES (
        ${input.instrumentId},
        ${input.institutionId},
        ${row.studentId},
        ${row.courseId ?? null},
        ${row.totalScore}
      )
    `
    n += 1
  }
  return n
}

export async function getSurveyConstructAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<SurveyConstructAnalytics> {
  const note =
    "Scores come from imported validated instruments only. Behavioral clickstream is not mapped to cognitive states."
  await ensureInstitutionSchema()

  const instruments = (await sql`
    SELECT COUNT(*)::int AS n FROM institution_survey_instruments WHERE institution_id = ${institutionId}
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>

  if (Number(instruments[0]?.n ?? 0) === 0) {
    return { available: false, instruments: 0, responses: 0, byConstruct: [], note }
  }

  const rows = (await sql`
    SELECT i.construct, ROUND(AVG(r.total_score::float)::numeric, 2) AS mean_score, COUNT(*)::int AS n
    FROM institution_survey_responses r
    JOIN institution_survey_instruments i ON i.id = r.instrument_id
    JOIN students st ON st.id = r.student_id
    WHERE r.institution_id = ${institutionId}
      AND (${scope.courseIds.length} = 0 OR st.course_id = ANY(${scope.courseIds}))
      AND r.submitted_at::date >= ${scope.from}::date AND r.submitted_at::date <= ${scope.to}::date
    GROUP BY 1
    HAVING COUNT(*) >= ${MIN_CELL_SIZE}
  `.catch(() => [])) as Array<{ construct: string; mean_score: number; n: number }>

  const byConstruct = rows.map((row) => ({
    key: row.construct,
    name: String(row.construct).replace(/_/g, " "),
    value: Number(row.mean_score),
  }))

  const responseCount = (await sql`
    SELECT COUNT(*)::int AS n
    FROM institution_survey_responses r
    JOIN students st ON st.id = r.student_id
    WHERE r.institution_id = ${institutionId}
      AND (${scope.courseIds.length} = 0 OR st.course_id = ANY(${scope.courseIds}))
      AND r.submitted_at::date >= ${scope.from}::date AND r.submitted_at::date <= ${scope.to}::date
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>

  return {
    available: byConstruct.length > 0,
    instruments: Number(instruments[0]?.n ?? 0),
    responses: Number(responseCount[0]?.n ?? 0),
    byConstruct,
    note,
  }
}
