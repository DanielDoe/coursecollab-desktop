import { sql } from "@/lib/db"
import { getCurriculumProjectId } from "@/lib/summer-camp/curriculum-progress"
import {
  compareCampModulesBySchedule,
  isCampModuleVisibleToStudents,
  sortCampModulesBySchedule,
  type CampScheduleDay,
} from "@/lib/summer-camp/module-schedule"
import { loadTrainingScheduleDays } from "@/lib/summer-camp/module-schedule-server"
import { ensureCampModuleScheduleColumns } from "@/lib/ensure-camp-module-schedule-columns"

export async function loadPublishedTrainingModules(
  trainingId: number,
  studentDbId: number | null,
  opts?: { curriculumOnly?: boolean },
) {
  const training = await sql`
    SELECT t.*, c.title AS camp_title, c.slug AS camp_slug
    FROM camp_trainings t
    JOIN summer_camps c ON c.id = t.camp_id
    WHERE t.id = ${trainingId}
    LIMIT 1
  `
  if (training.length === 0) return null

  const projects = await sql`
    SELECT p.id, p.title, p.description, p.sort_order, p.metadata
    FROM camp_projects p
    WHERE p.training_id = ${trainingId}
    ORDER BY p.sort_order ASC
  `

  const curriculumProjectId = opts?.curriculumOnly
    ? await getCurriculumProjectId(trainingId)
    : null

  const modulesWithProgress = []
  for (const project of projects as Array<{ id: number; title?: string; metadata?: { kind?: string } | null }>) {
    const kind = (project.metadata as { kind?: string } | null)?.kind ?? ""
    if (opts?.curriculumOnly) {
      if (curriculumProjectId != null) {
        if (project.id !== curriculumProjectId) continue
      } else if (kind === "capstone" || kind === "team_capstone") {
        continue
      } else if (kind !== "curriculum" && !(project.title ?? "").includes("Training Journey")) {
        continue
      }
    }

    await ensureCampModuleScheduleColumns()
    const modulesRaw = await sql`
      SELECT
        m.id,
        m.title,
        m.description,
        m.sort_order,
        m.status,
        m.schedule_day,
        m.schedule_day_sort,
        COALESCE(m.is_visible, true) AS is_visible,
        m.display_number
      FROM camp_modules m
      WHERE m.project_id = ${project.id} AND m.status = 'published'
    `
    const modules = sortCampModulesBySchedule(
      (modulesRaw as Array<{ is_visible?: boolean }>).filter(isCampModuleVisibleToStudents),
    )
    for (const mod of modules as Array<{ id: number }>) {
      let isComplete = false
      if (studentDbId != null) {
        const completed = await sql`
          SELECT 1 FROM camp_progress
          WHERE student_id = ${studentDbId} AND module_id = ${mod.id}
            AND progress_type = 'module_complete'
          LIMIT 1
        `
        isComplete = completed.length > 0
      }
      modulesWithProgress.push({
        ...mod,
        project_id: project.id,
        project_title: project.title,
        is_complete: isComplete,
      })
    }
  }

  const scheduleDays = await loadTrainingScheduleDays(trainingId)

  return {
    training: training[0],
    projects,
    modules: modulesWithProgress,
    schedule_days: scheduleDays as CampScheduleDay[],
  }
}

export type NextCurriculumLesson = {
  id: number
  title: string
}

/** Next published curriculum module after the current one (any training track). */
export async function getNextCurriculumModule(
  trainingId: number,
  currentModuleId: number,
): Promise<NextCurriculumLesson | null> {
  const payload = await loadPublishedTrainingModules(trainingId, null, { curriculumOnly: true })
  if (!payload) return null

  const modules = [...payload.modules].sort(compareCampModulesBySchedule)
  const index = modules.findIndex((m) => Number(m.id) === currentModuleId)
  if (index < 0 || index >= modules.length - 1) return null

  const next = modules[index + 1] as { id: number; title: string }
  return { id: next.id, title: String(next.title) }
}
