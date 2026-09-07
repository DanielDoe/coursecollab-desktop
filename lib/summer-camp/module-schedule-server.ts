import { sql, asSqlRows } from "@/lib/db"
import { ensureCampModuleScheduleColumns } from "@/lib/ensure-camp-module-schedule-columns"
import { getCurriculumProjectId } from "@/lib/summer-camp/curriculum-progress"
import {
  normalizeScheduleDays,
  normalizeScheduleModuleRules,
  renumberCampModuleTitle,
  resolveModuleScheduleFromRules,
  sortCampModulesBySchedule,
  type CampModuleScheduleRule,
  type CampModuleScheduleRow,
  type CampScheduleDay,
  type CampTrainingScheduleConfig,
} from "@/lib/summer-camp/module-schedule"

export async function loadCurriculumModulesForTraining(
  trainingId: number,
): Promise<CampModuleScheduleRow[]> {
  await ensureCampModuleScheduleColumns()
  const projectId = await getCurriculumProjectId(trainingId)
  if (projectId == null) return []

  return asSqlRows<CampModuleScheduleRow>(await sql`
    SELECT
      m.id,
      m.title,
      m.description,
      m.sort_order,
      m.status,
      m.schedule_day,
      m.schedule_day_sort,
      COALESCE(m.is_visible, true) AS is_visible,
      m.display_number,
      m.project_id
    FROM camp_modules m
    WHERE m.project_id = ${projectId}
    ORDER BY m.schedule_day ASC NULLS LAST, m.schedule_day_sort ASC, m.sort_order ASC, m.id ASC
  `)
}

export async function loadTrainingScheduleDays(trainingId: number): Promise<CampScheduleDay[]> {
  await ensureCampModuleScheduleColumns()
  const rows = asSqlRows<{ schedule_days: CampScheduleDay[] | null }>(await sql`
    SELECT schedule_days FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `)
  return normalizeScheduleDays(rows[0]?.schedule_days)
}

export async function loadTrainingScheduleModuleRules(trainingId: number): Promise<CampModuleScheduleRule[]> {
  await ensureCampModuleScheduleColumns()
  const rows = asSqlRows<{ schedule_module_rules: CampModuleScheduleRule[] | null }>(await sql`
    SELECT schedule_module_rules FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `)
  return normalizeScheduleModuleRules(rows[0]?.schedule_module_rules)
}

export async function loadTrainingScheduleConfig(trainingId: number): Promise<CampTrainingScheduleConfig> {
  const [days, moduleRules] = await Promise.all([
    loadTrainingScheduleDays(trainingId),
    loadTrainingScheduleModuleRules(trainingId),
  ])
  return { days, moduleRules }
}

export async function saveTrainingScheduleDays(trainingId: number, days: CampScheduleDay[]) {
  await ensureCampModuleScheduleColumns()
  await sql`
    UPDATE camp_trainings
    SET schedule_days = ${JSON.stringify(normalizeScheduleDays(days))}::jsonb, updated_at = NOW()
    WHERE id = ${trainingId}
  `
}

export async function saveTrainingScheduleModuleRules(
  trainingId: number,
  rules: CampModuleScheduleRule[],
) {
  await ensureCampModuleScheduleColumns()
  await sql`
    UPDATE camp_trainings
    SET schedule_module_rules = ${JSON.stringify(normalizeScheduleModuleRules(rules))}::jsonb, updated_at = NOW()
    WHERE id = ${trainingId}
  `
}

export async function saveTrainingScheduleConfig(trainingId: number, config: CampTrainingScheduleConfig) {
  await saveTrainingScheduleDays(trainingId, config.days)
  await saveTrainingScheduleModuleRules(trainingId, config.moduleRules)
}

export async function applyCampModuleSchedule(
  trainingId: number,
  opts?: { renumberTitles?: boolean },
) {
  await ensureCampModuleScheduleColumns()
  const modules = await loadCurriculumModulesForTraining(trainingId)
  const ordered = sortCampModulesBySchedule(modules)

  for (let i = 0; i < ordered.length; i++) {
    const mod = ordered[i]!
    const displayNumber = i
    const nextTitle = opts?.renumberTitles
      ? renumberCampModuleTitle(mod.title, displayNumber)
      : mod.title

    await sql`
      UPDATE camp_modules
      SET
        sort_order = ${i},
        display_number = ${displayNumber},
        title = ${nextTitle},
        updated_at = NOW()
      WHERE id = ${mod.id}
    `
  }

  return { modulesUpdated: ordered.length }
}

export async function applyScheduleRulesToCurriculumModules(
  trainingId: number,
  rules: CampModuleScheduleRule[],
) {
  await ensureCampModuleScheduleColumns()
  const modules = await loadCurriculumModulesForTraining(trainingId)
  let updated = 0
  for (const mod of modules) {
    const slot = resolveModuleScheduleFromRules(mod.title, rules)
    if (!slot) continue
    await sql`
      UPDATE camp_modules
      SET
        schedule_day = ${slot.schedule_day},
        schedule_day_sort = ${slot.schedule_day_sort},
        updated_at = NOW()
      WHERE id = ${mod.id}
    `
    updated++
  }
  return { modulesUpdated: updated }
}

export async function updateCampModuleScheduleFields(
  moduleId: number,
  patch: {
    schedule_day?: number | null
    schedule_day_sort?: number
    is_visible?: boolean
  },
) {
  await ensureCampModuleScheduleColumns()
  await sql`
    UPDATE camp_modules
    SET
      schedule_day = CASE
        WHEN ${patch.schedule_day === undefined} THEN schedule_day
        ELSE ${patch.schedule_day}
      END,
      schedule_day_sort = COALESCE(${patch.schedule_day_sort ?? null}, schedule_day_sort),
      is_visible = COALESCE(${patch.is_visible ?? null}, is_visible),
      updated_at = NOW()
    WHERE id = ${moduleId}
  `
}
