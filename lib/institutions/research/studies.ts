import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { resolveInstitutionScope } from "@/lib/institutions/metrics/scope"
import { MIN_CELL_SIZE } from "@/lib/institutions/research/capability-catalog"
import { researchStudentId } from "@/lib/institutions/research/research-ids"
import { CONTRAST_NOTE, descriptiveStats, groupContrast, toCsv, type DescriptiveStats, type GroupContrast } from "@/lib/institutions/research/stats"

import {
  COHORT_DEFINITIONS,
  COHORT_ROLES,
  OUTCOME_METRICS,
  STUDY_DESIGNS,
  STUDY_STATUSES,
  type CohortDefinition,
  type CohortRole,
  type OutcomeMetric,
  type ResearchCohort,
  type ResearchStudy,
  type StudyDesign,
  type StudyStatus,
} from "@/lib/institutions/research/study-types"

export {
  COHORT_DEFINITIONS,
  COHORT_ROLES,
  OUTCOME_METRICS,
  STUDY_DESIGNS,
  STUDY_STATUSES,
} from "@/lib/institutions/research/study-types"
export type {
  CohortDefinition,
  CohortRole,
  OutcomeMetric,
  ResearchCohort,
  ResearchStudy,
  StudyDesign,
  StudyStatus,
} from "@/lib/institutions/research/study-types"

export type CohortSummary = {
  cohort: ResearchCohort
  n: number
  stats: DescriptiveStats
}

export type StudyComparison = {
  study: ResearchStudy
  outcomeMetric: OutcomeMetric
  groups: CohortSummary[]
  contrast: GroupContrast | null
  causalEligible: boolean
  designNote: string
  cellMinimum: number
}

export type ResearchExportLog = {
  id: number
  dataset: string
  studyId: string | null
  rowCount: number | null
  createdAt: string
}

const INDEPENDENT_POLICIES = ["AI_RESTRICTED", "AI_UNAVAILABLE", "INDEPENDENT_CHECK"]

function asDesign(v: unknown): StudyDesign {
  return STUDY_DESIGNS.includes(String(v) as StudyDesign) ? (v as StudyDesign) : "observational"
}
function asStatus(v: unknown): StudyStatus {
  return STUDY_STATUSES.includes(String(v) as StudyStatus) ? (v as StudyStatus) : "draft"
}
function asOutcome(v: unknown): OutcomeMetric {
  return OUTCOME_METRICS.includes(String(v) as OutcomeMetric) ? (v as OutcomeMetric) : "assessment_score"
}
function asDef(v: unknown): CohortDefinition {
  return COHORT_DEFINITIONS.includes(String(v) as CohortDefinition) ? (v as CohortDefinition) : "roster"
}
function asRole(v: unknown): CohortRole {
  return COHORT_ROLES.includes(String(v) as CohortRole) ? (v as CohortRole) : "group"
}

function iso(v: unknown): string | null {
  if (!v) return null
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

function designNote(design: StudyDesign): string {
  if (design === "authorized_experiment") {
    return "Authorization is recorded. This screen does not assign students or change product behavior."
  }
  if (design === "pre_post") {
    return "Pre/post gain needs comparable instruments on the same learners. Usage timestamps alone are not a learning gain."
  }
  if (design === "comparison") {
    return "Configured group contrast. Cora users vs non-users is observational, not a causal AI effect."
  }
  return "Observational study. Groups describe who already used a feature. They are not randomly assigned."
}

function mapStudy(row: Record<string, unknown>, cohorts: ResearchCohort[]): ResearchStudy {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    design: asDesign(row.design),
    status: asStatus(row.status),
    outcomeMetric: asOutcome(row.outcome_metric),
    fromDate: iso(row.from_date),
    toDate: iso(row.to_date),
    authorizationNote: row.authorization_note != null ? String(row.authorization_note) : null,
    assignmentChangesExperience: Boolean(row.assignment_changes_experience),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    cohorts,
  }
}

function mapCohort(row: Record<string, unknown>): ResearchCohort {
  return {
    id: Number(row.id),
    studyId: Number(row.study_id),
    name: String(row.name),
    roleInStudy: asRole(row.role_in_study),
    definitionType: asDef(row.definition_type),
    notes: row.notes != null ? String(row.notes) : null,
  }
}

export async function listResearchStudies(institutionId: number): Promise<ResearchStudy[]> {
  await ensureInstitutionSchema()
  const studies = await sql`
    SELECT * FROM institution_research_studies
    WHERE institution_id = ${institutionId}
    ORDER BY updated_at DESC
  `.catch(() => [])
  if (studies.length === 0) return []
  const ids = studies.map((s) => Number(s.id))
  const cohorts = await sql`
    SELECT * FROM institution_research_cohorts
    WHERE institution_id = ${institutionId} AND study_id = ANY(${ids})
    ORDER BY id ASC
  `.catch(() => [])
  const byStudy = new Map<number, ResearchCohort[]>()
  for (const row of cohorts) {
    const c = mapCohort(row as Record<string, unknown>)
    const list = byStudy.get(c.studyId) ?? []
    list.push(c)
    byStudy.set(c.studyId, list)
  }
  return studies.map((row) => mapStudy(row as Record<string, unknown>, byStudy.get(Number(row.id)) ?? []))
}

export async function getResearchStudy(institutionId: number, studyId: number): Promise<ResearchStudy | null> {
  const all = await listResearchStudies(institutionId)
  return all.find((s) => s.id === studyId) ?? null
}

export async function createResearchStudy(
  institutionId: number,
  actorUserId: number,
  input: {
    name: string
    description?: string
    design?: string
    outcomeMetric?: string
    fromDate?: string | null
    toDate?: string | null
    authorizationNote?: string | null
  },
): Promise<ResearchStudy> {
  await ensureInstitutionSchema()
  const name = input.name.trim().slice(0, 200)
  if (!name) throw new Error("Study name is required")
  const design = asDesign(input.design)
  const status: StudyStatus =
    design === "authorized_experiment" && input.authorizationNote?.trim() ? "authorized" : "draft"
  const rows = await sql`
    INSERT INTO institution_research_studies (
      institution_id, name, description, design, status, outcome_metric,
      from_date, to_date, authorization_note, assignment_changes_experience, created_by_user_id
    ) VALUES (
      ${institutionId},
      ${name},
      ${input.description?.trim() || null},
      ${design},
      ${status},
      ${asOutcome(input.outcomeMetric)},
      ${input.fromDate || null},
      ${input.toDate || null},
      ${input.authorizationNote?.trim() || null},
      false,
      ${actorUserId}
    )
    RETURNING *
  `
  return mapStudy(rows[0] as Record<string, unknown>, [])
}

export async function updateResearchStudy(
  institutionId: number,
  studyId: number,
  input: {
    name?: string
    description?: string | null
    design?: string
    outcomeMetric?: string
    fromDate?: string | null
    toDate?: string | null
    authorizationNote?: string | null
    status?: string
  },
): Promise<ResearchStudy | null> {
  const current = await getResearchStudy(institutionId, studyId)
  if (!current) return null
  const design = input.design != null ? asDesign(input.design) : current.design
  const note = input.authorizationNote !== undefined ? input.authorizationNote : current.authorizationNote
  let status = input.status != null ? asStatus(input.status) : current.status
  if (design === "authorized_experiment" && note?.trim()) status = "authorized"
  else if (design !== "authorized_experiment" && status === "authorized") status = "configured"
  const cohorts = current.cohorts
  if (cohorts.length >= 2 && status === "draft") status = "configured"
  await sql`
    UPDATE institution_research_studies SET
      name = ${input.name?.trim() || current.name},
      description = ${input.description !== undefined ? input.description : current.description},
      design = ${design},
      status = ${status},
      outcome_metric = ${input.outcomeMetric != null ? asOutcome(input.outcomeMetric) : current.outcomeMetric},
      from_date = ${input.fromDate !== undefined ? input.fromDate : current.fromDate},
      to_date = ${input.toDate !== undefined ? input.toDate : current.toDate},
      authorization_note = ${note},
      assignment_changes_experience = false,
      updated_at = NOW()
    WHERE id = ${studyId} AND institution_id = ${institutionId}
  `
  return getResearchStudy(institutionId, studyId)
}

export async function deleteResearchStudy(institutionId: number, studyId: number): Promise<boolean> {
  const res = await sql`
    DELETE FROM institution_research_studies
    WHERE id = ${studyId} AND institution_id = ${institutionId}
    RETURNING id
  `.catch(() => [])
  return res.length > 0
}

export async function addResearchCohort(
  institutionId: number,
  studyId: number,
  input: { name: string; roleInStudy?: string; definitionType?: string; notes?: string },
): Promise<ResearchCohort> {
  const study = await getResearchStudy(institutionId, studyId)
  if (!study) throw new Error("Study not found")
  const name = input.name.trim().slice(0, 120)
  if (!name) throw new Error("Cohort name is required")
  const rows = await sql`
    INSERT INTO institution_research_cohorts (
      study_id, institution_id, name, role_in_study, definition_type, notes
    ) VALUES (
      ${studyId},
      ${institutionId},
      ${name},
      ${asRole(input.roleInStudy)},
      ${asDef(input.definitionType)},
      ${input.notes?.trim() || null}
    )
    RETURNING *
  `
  if (study.status === "draft") {
    await sql`
      UPDATE institution_research_studies SET status = 'configured', updated_at = NOW()
      WHERE id = ${studyId} AND institution_id = ${institutionId}
    `
  }
  return mapCohort(rows[0] as Record<string, unknown>)
}

export async function removeResearchCohort(institutionId: number, cohortId: number): Promise<boolean> {
  const res = await sql`
    DELETE FROM institution_research_cohorts
    WHERE id = ${cohortId} AND institution_id = ${institutionId}
    RETURNING id
  `.catch(() => [])
  return res.length > 0
}

async function cohortStudentIds(
  institutionId: number,
  courseIds: number[],
  from: string,
  to: string,
  definition: CohortDefinition,
): Promise<number[]> {
  if (courseIds.length === 0) return []
  const rows = await (async () => {
    if (definition === "cora") {
      return sql`
        SELECT DISTINCT st.id FROM students st
        WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM institution_cora_usage u
            WHERE u.institution_id = ${institutionId} AND u.user_type = 'student' AND u.user_id = st.id
              AND u.created_at::date >= ${from}::date AND u.created_at::date <= ${to}::date
          )
      `
    }
    if (definition === "no_cora") {
      return sql`
        SELECT DISTINCT st.id FROM students st
        WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM institution_cora_usage u
            WHERE u.institution_id = ${institutionId} AND u.user_type = 'student' AND u.user_id = st.id
              AND u.created_at::date >= ${from}::date AND u.created_at::date <= ${to}::date
          )
      `
    }
    if (definition === "practice") {
      return sql`
        SELECT DISTINCT st.id FROM students st
        JOIN practice_attempts pa ON pa.student_id = st.id
        WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
          AND COALESCE(pa.completed_at, pa.started_at)::date >= ${from}::date
          AND COALESCE(pa.completed_at, pa.started_at)::date <= ${to}::date
      `
    }
    if (definition === "assessment") {
      return sql`
        SELECT DISTINCT st.id FROM students st
        JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
          AND qa.completed_at::date >= ${from}::date AND qa.completed_at::date <= ${to}::date
      `
    }
    if (definition === "independent") {
      return sql`
        SELECT DISTINCT st.id FROM students st
        JOIN quiz_attempts qa ON qa.student_id = st.id AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
        JOIN quizzes q ON q.id = qa.quiz_id
        WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
          AND qa.completed_at::date >= ${from}::date AND qa.completed_at::date <= ${to}::date
          AND UPPER(TRIM(q.ai_policy)) = ANY(${INDEPENDENT_POLICIES})
      `.catch(() => [])
    }
    return sql`
      SELECT st.id FROM students st
      WHERE st.course_id = ANY(${courseIds}) AND st.deleted_at IS NULL
    `
  })()
  return rows.map((r) => Number(r.id)).filter((id) => id > 0)
}

async function studentOutcomes(
  institutionId: number,
  studentIds: number[],
  from: string,
  to: string,
  metric: OutcomeMetric,
): Promise<Map<number, number>> {
  const out = new Map<number, number>()
  if (studentIds.length === 0) return out
  if (metric === "practice_accuracy") {
    const rows = await sql`
      SELECT pa.student_id, AVG(pa.score_percentage::float) AS value
      FROM practice_attempts pa
      WHERE pa.student_id = ANY(${studentIds})
        AND COALESCE(pa.completed_at, pa.started_at)::date >= ${from}::date
        AND COALESCE(pa.completed_at, pa.started_at)::date <= ${to}::date
        AND pa.score_percentage IS NOT NULL
      GROUP BY 1
    `
    for (const row of rows) out.set(Number(row.student_id), Number(row.value))
    return out
  }
  if (metric === "cora_sessions") {
    const rows = await sql`
      SELECT u.user_id AS student_id, COUNT(*)::int AS value
      FROM institution_cora_usage u
      WHERE u.institution_id = ${institutionId} AND u.user_type = 'student'
        AND u.user_id = ANY(${studentIds})
        AND u.created_at::date >= ${from}::date AND u.created_at::date <= ${to}::date
      GROUP BY 1
    `
    for (const id of studentIds) out.set(id, 0)
    for (const row of rows) out.set(Number(row.student_id), Number(row.value))
    return out
  }
  const rows = await sql`
    SELECT qa.student_id, AVG(qa.score::float) AS value
    FROM quiz_attempts qa
    WHERE qa.student_id = ANY(${studentIds}) AND qa.deleted_at IS NULL AND qa.completed_at IS NOT NULL
      AND qa.completed_at::date >= ${from}::date AND qa.completed_at::date <= ${to}::date
      AND qa.score IS NOT NULL
    GROUP BY 1
  `
  for (const row of rows) out.set(Number(row.student_id), Number(row.value))
  return out
}

async function studyWindow(institutionId: number, study: ResearchStudy): Promise<{ from: string; to: string; courseIds: number[] }> {
  const scope = await resolveInstitutionScope(institutionId, {
    institutionId,
    from: study.fromDate ?? "",
    to: study.toDate ?? "",
    preset: study.fromDate && study.toDate ? "custom" : "last_30_days",
  })
  const from = study.fromDate ?? scope?.from ?? new Date().toISOString().slice(0, 10)
  const to = study.toDate ?? scope?.to ?? from
  return { from, to, courseIds: scope?.courseIds ?? [] }
}

export async function compareResearchStudy(institutionId: number, studyId: number): Promise<StudyComparison | null> {
  const study = await getResearchStudy(institutionId, studyId)
  if (!study) return null
  const { from, to, courseIds } = await studyWindow(institutionId, study)
  const groups: CohortSummary[] = []
  const valueSets: number[][] = []
  for (const cohort of study.cohorts) {
    const ids = await cohortStudentIds(institutionId, courseIds, from, to, cohort.definitionType)
    const outcomes = await studentOutcomes(institutionId, ids, from, to, study.outcomeMetric)
    const values = [...outcomes.values()]
    valueSets.push(values)
    groups.push({
      cohort,
      n: values.length,
      stats: descriptiveStats(values),
    })
  }
  const contrast =
    valueSets.length >= 2 ? groupContrast(valueSets[0] ?? [], valueSets[1] ?? []) : null
  const causalEligible =
    study.design === "authorized_experiment" && Boolean(study.authorizationNote?.trim()) && !study.assignmentChangesExperience
  return {
    study,
    outcomeMetric: study.outcomeMetric,
    groups,
    contrast,
    causalEligible,
    designNote: designNote(study.design),
    cellMinimum: MIN_CELL_SIZE,
  }
}

export async function listResearchExportLogs(institutionId: number): Promise<ResearchExportLog[]> {
  const rows = await sql`
    SELECT id, dataset, study_id, row_count, created_at
    FROM institution_research_export_logs
    WHERE institution_id = ${institutionId}
    ORDER BY created_at DESC
    LIMIT 20
  `.catch(() => [])
  return rows.map((row) => ({
    id: Number(row.id),
    dataset: String(row.dataset),
    studyId: row.study_id != null ? String(row.study_id) : null,
    rowCount: row.row_count != null ? Number(row.row_count) : null,
    createdAt: String(row.created_at ?? ""),
  }))
}

export async function buildResearchExport(
  institutionId: number,
  actorUserId: number,
  studyId: number,
  dataset: "summary" | "outcomes",
): Promise<{ filename: string; csv: string; rowCount: number }> {
  const comparison = await compareResearchStudy(institutionId, studyId)
  if (!comparison) throw new Error("Study not found")
  const { study, groups, contrast } = comparison
  let csv: string
  let rowCount: number
  if (dataset === "summary") {
    const headers = ["study", "design", "outcome", "cohort", "role", "definition", "n", "mean", "median", "sd", "min", "max", "mean_diff", "cohens_d", "note"]
    const rows = groups.map((g, i) => [
      study.name,
      study.design,
      study.outcomeMetric,
      g.cohort.name,
      g.cohort.roleInStudy,
      g.cohort.definitionType,
      g.stats.n,
      g.stats.insufficient ? null : g.stats.mean,
      g.stats.insufficient ? null : g.stats.median,
      g.stats.insufficient ? null : g.stats.sd,
      g.stats.insufficient ? null : g.stats.min,
      g.stats.insufficient ? null : g.stats.max,
      i === 0 ? contrast?.meanDiff ?? null : null,
      i === 0 ? contrast?.cohensD ?? null : null,
      contrast?.note ?? CONTRAST_NOTE,
    ])
    csv = toCsv(headers, rows)
    rowCount = rows.length
  } else {
    const { from, to, courseIds } = await studyWindow(institutionId, study)
    const headers = ["research_student_id", "cohort", "role", "definition", "outcome_metric", "value"]
    const rows: Array<Array<string | number | null>> = []
    for (const g of groups) {
      if (g.stats.insufficient) continue
      const ids = await cohortStudentIds(institutionId, courseIds, from, to, g.cohort.definitionType)
      const outcomes = await studentOutcomes(institutionId, ids, from, to, study.outcomeMetric)
      for (const [studentId, value] of outcomes) {
        rows.push([
          researchStudentId(institutionId, studentId),
          g.cohort.name,
          g.cohort.roleInStudy,
          g.cohort.definitionType,
          study.outcomeMetric,
          Math.round(value * 10) / 10,
        ])
      }
    }
    csv = toCsv(headers, rows)
    rowCount = rows.length
  }

  await sql`
    INSERT INTO institution_research_export_logs (
      institution_id, actor_user_id, dataset, filters_json, study_id, row_count
    ) VALUES (
      ${institutionId},
      ${actorUserId},
      ${dataset},
      ${JSON.stringify({ outcome: study.outcomeMetric, design: study.design })},
      ${String(study.id)},
      ${rowCount}
    )
  `.catch(() => [])

  const slug = study.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "study"
  return { filename: `${slug}-${dataset}.csv`, csv, rowCount }
}

export async function getResearchWorkspace(institutionId: number, studyId?: number | null) {
  const studies = await listResearchStudies(institutionId)
  const selectedId = studyId ?? studies[0]?.id ?? null
  const comparison = selectedId ? await compareResearchStudy(institutionId, selectedId) : null
  const exports = await listResearchExportLogs(institutionId)
  return {
    studies,
    selectedStudyId: selectedId,
    comparison,
    exports,
    cellMinimum: MIN_CELL_SIZE,
    exportReady: Boolean(comparison && comparison.groups.some((g) => !g.stats.insufficient)),
    note: "Studies record a design. They do not assign treatments or change a learner experience. Exports use de-identified research IDs.",
  }
}
