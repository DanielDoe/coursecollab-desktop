import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import type { InstitutionNamedCount } from "@/lib/institutions/insights"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export type EquitySubgroupAnalytics = {
  available: boolean
  cellMinimum: number
  attributesImported: number
  unavailableReason: string | null
  subgroups: InstitutionNamedCount[]
  outcomeBySubgroup: Array<{ subgroup: string; meanScore: number | null; n: number; suppressed: boolean }>
  note: string
}

export async function importEquityAttributes(input: {
  institutionId: number
  authorizedByUserId: number
  rows: Array<{ studentId: number; attributeKey: string; attributeValue: string }>
}): Promise<number> {
  await ensureInstitutionSchema()
  let n = 0
  for (const row of input.rows) {
    if (!Number.isFinite(row.studentId) || row.studentId <= 0) continue
    const key = row.attributeKey.trim().slice(0, 64)
    const value = row.attributeValue.trim().slice(0, 64)
    if (!key || !value) continue
    await sql`
      INSERT INTO institution_equity_attributes (
        institution_id, student_id, attribute_key, attribute_value, authorized_by_user_id
      ) VALUES (
        ${input.institutionId},
        ${row.studentId},
        ${key},
        ${value},
        ${input.authorizedByUserId}
      )
      ON CONFLICT (institution_id, student_id, attribute_key) DO UPDATE SET
        attribute_value = EXCLUDED.attribute_value,
        authorized_by_user_id = EXCLUDED.authorized_by_user_id,
        authorized_at = NOW()
    `
    n += 1
  }
  return n
}

export async function getEquitySubgroupAnalytics(
  scope: InstitutionScope,
  institutionId: number,
): Promise<EquitySubgroupAnalytics> {
  const note =
    "Subgroup outcomes use authorized attributes only. Cells below N minimum are suppressed. Descriptive — not causal."
  await ensureInstitutionSchema()

  const attrCount = (await sql`
    SELECT COUNT(*)::int AS n FROM institution_equity_attributes WHERE institution_id = ${institutionId}
  `.catch(() => [{ n: 0 }])) as Array<{ n: number }>

  const imported = Number(attrCount[0]?.n ?? 0)
  if (imported === 0 || scope.courseIds.length === 0) {
    return {
      available: false,
      cellMinimum: MIN_CELL_SIZE,
      attributesImported: imported,
      unavailableReason: imported === 0 ? "No authorized equity attributes imported." : "No courses in scope.",
      subgroups: [],
      outcomeBySubgroup: [],
      note,
    }
  }

  const rows = (await sql`
    SELECT ea.attribute_key, ea.attribute_value, COUNT(DISTINCT ea.student_id)::int AS n,
      ROUND(AVG(qa.score::float)::numeric, 1) AS mean_score
    FROM institution_equity_attributes ea
    JOIN students st ON st.id = ea.student_id
    LEFT JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
      AND qa.completed_at::date >= ${scope.from}::date AND qa.completed_at::date <= ${scope.to}::date
    WHERE ea.institution_id = ${institutionId}
      AND st.course_id = ANY(${scope.courseIds}) AND st.deleted_at IS NULL
    GROUP BY 1, 2
    ORDER BY 3 DESC
  `.catch(() => [])) as Array<{ attribute_key: string; attribute_value: string; n: number; mean_score: number | null }>

  const subgroups: InstitutionNamedCount[] = []
  const outcomeBySubgroup: EquitySubgroupAnalytics["outcomeBySubgroup"] = []

  for (const row of rows) {
    const label = `${row.attribute_key}: ${row.attribute_value}`
    const n = Number(row.n)
    const suppressed = n < MIN_CELL_SIZE
    subgroups.push({ key: label, name: label, value: suppressed ? 0 : n })
    outcomeBySubgroup.push({
      subgroup: label,
      meanScore: suppressed ? null : row.mean_score != null ? Number(row.mean_score) : null,
      n,
      suppressed,
    })
  }

  const visible = outcomeBySubgroup.filter((r) => !r.suppressed)
  return {
    available: visible.length > 0,
    cellMinimum: MIN_CELL_SIZE,
    attributesImported: imported,
    unavailableReason: visible.length === 0 ? `All cells below N ≥ ${MIN_CELL_SIZE}.` : null,
    subgroups: subgroups.filter((s) => s.value > 0),
    outcomeBySubgroup: visible,
    note,
  }
}
