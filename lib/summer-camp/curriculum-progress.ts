import { sql } from "@/lib/db"
import { ensureCampModuleScheduleColumns } from "@/lib/ensure-camp-module-schedule-columns"

export type CurriculumProgress = {
  project_id: number | null
  total_modules: number
  completed_modules: number
  percent: number
  complete: boolean
}

/** Curriculum track (Modules 0–11), not capstone projects. */
export async function getCurriculumProjectId(trainingId: number): Promise<number | null> {
  const rows = (await sql`
    SELECT id FROM camp_projects
    WHERE training_id = ${trainingId}
      AND (
        metadata->>'kind' = 'curriculum'
        OR title ILIKE '%Training Journey%'
        OR (
          COALESCE(metadata->>'kind', '') NOT IN ('capstone', 'team_capstone')
          AND sort_order < 10
          AND EXISTS (
            SELECT 1 FROM camp_modules m
            WHERE m.project_id = camp_projects.id AND m.status = 'published'
          )
        )
      )
    ORDER BY
      CASE
        WHEN metadata->>'kind' = 'curriculum' THEN 0
        WHEN title ILIKE '%Training Journey%' THEN 1
        ELSE 2
      END ASC,
      sort_order ASC,
      id ASC
    LIMIT 1
  `) as Array<{ id: number }>
  return rows[0]?.id ?? null
}

export async function isCapstoneModule(moduleId: number): Promise<boolean> {
  const rows = (await sql`
    SELECT COALESCE(p.metadata->>'kind', '') AS kind
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    WHERE m.id = ${moduleId}
    LIMIT 1
  `) as Array<{ kind: string }>
  return rows[0]?.kind === "capstone" || rows[0]?.kind === "team_capstone"
}

export async function getCurriculumProgress(
  trainingId: number,
  studentDbId: number,
): Promise<CurriculumProgress> {
  const projectId = await getCurriculumProjectId(trainingId)
  if (projectId == null) {
    return { project_id: null, total_modules: 0, completed_modules: 0, percent: 0, complete: false }
  }

  await ensureCampModuleScheduleColumns()

  const [totalRow] = (await sql`
    SELECT COUNT(*)::int AS c FROM camp_modules
    WHERE project_id = ${projectId}
      AND status = 'published'
      AND COALESCE(is_visible, true) = true
  `) as Array<{ c: number }>

  const [doneRow] = (await sql`
    SELECT COUNT(DISTINCT cp.module_id)::int AS c
    FROM camp_progress cp
    JOIN camp_modules m ON m.id = cp.module_id
    WHERE cp.student_id = ${studentDbId}
      AND cp.progress_type = 'module_complete'
      AND m.project_id = ${projectId}
      AND m.status = 'published'
      AND COALESCE(m.is_visible, true) = true
  `) as Array<{ c: number }>

  const total = totalRow?.c ?? 0
  const completed = doneRow?.c ?? 0
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0

  return {
    project_id: projectId,
    total_modules: total,
    completed_modules: completed,
    percent,
    complete: total > 0 && completed >= total,
  }
}

export async function assertCapstoneAccess(moduleId: number, studentDbId: number): Promise<{
  ok: true
} | { ok: false; message: string; curriculum: CurriculumProgress }> {
  const capstone = await isCapstoneModule(moduleId)
  if (!capstone) return { ok: true }

  const projectRows = (await sql`
    SELECT p.training_id, p.metadata
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    WHERE m.id = ${moduleId}
    LIMIT 1
  `) as Array<{ training_id: number; metadata: Record<string, unknown> | null }>

  const trainingId = projectRows[0]?.training_id
  if (trainingId == null) return { ok: true }

  const meta = (projectRows[0]?.metadata ?? {}) as Record<string, unknown>
  const assignedRaw = meta.assigned_student_id
  if (assignedRaw != null && assignedRaw !== "" && Number(assignedRaw) !== studentDbId) {
    const assigned = meta.assigned_student as { full_name?: string } | undefined
    const name = assigned?.full_name ? ` (${assigned.full_name})` : ""
    const curriculum = await getCurriculumProgress(trainingId, studentDbId)
    return {
      ok: false,
      message: `This research project is assigned to another team member${name}.`,
      curriculum,
    }
  }

  const curriculum = await getCurriculumProgress(trainingId, studentDbId)
  if (!curriculum.complete) {
    return {
      ok: false,
      message: `Complete all training modules first (${curriculum.completed_modules}/${curriculum.total_modules} done). Advanced projects unlock after the full curriculum.`,
      curriculum,
    }
  }
  return { ok: true }
}
