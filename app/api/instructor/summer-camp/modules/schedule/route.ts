import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { isFacultyAssignedToTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { ensureCampModuleScheduleColumns } from "@/lib/ensure-camp-module-schedule-columns"
import {
  buildScheduleRulesFromModuleAssignments,
  getDefaultTrainingScheduleConfig,
  normalizeScheduleDays,
  normalizeScheduleModuleRules,
  sortCampModulesBySchedule,
  type CampModuleScheduleRule,
  type CampScheduleDay,
} from "@/lib/summer-camp/module-schedule"
import {
  applyCampModuleSchedule,
  applyScheduleRulesToCurriculumModules,
  loadCurriculumModulesForTraining,
  loadTrainingScheduleConfig,
  saveTrainingScheduleConfig,
} from "@/lib/summer-camp/module-schedule-server"

export const dynamic = "force-dynamic"

async function loadTrainingSlug(trainingId: number): Promise<string | null> {
  const rows = asSqlRows<{ slug: string }>(await sql`
    SELECT slug FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
  `)
  return rows[0]?.slug ?? null
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const trainingId = Number(request.nextUrl.searchParams.get("trainingId"))
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    await ensureCampModuleScheduleColumns()
    const slug = await loadTrainingSlug(trainingId)
    const modules = sortCampModulesBySchedule(await loadCurriculumModulesForTraining(trainingId))
    const scheduleConfig = await loadTrainingScheduleConfig(trainingId)
    const defaultSchedule = getDefaultTrainingScheduleConfig(slug)

    return NextResponse.json({
      modules,
      schedule_days: scheduleConfig.days,
      schedule_module_rules: scheduleConfig.moduleRules,
      default_schedule: defaultSchedule,
      training_slug: slug,
    })
  } catch (error) {
    console.error("[instructor/summer-camp/modules/schedule GET]", error)
    return NextResponse.json({ error: "Failed to load module schedule" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const trainingId = Number(body.training_id)
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "training_id required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    await ensureCampModuleScheduleColumns()

    const slug = await loadTrainingSlug(trainingId)
    const defaultSchedule = getDefaultTrainingScheduleConfig(slug)

    if (body.reset_to_defaults === true && defaultSchedule) {
      await saveTrainingScheduleConfig(trainingId, defaultSchedule)
      await applyScheduleRulesToCurriculumModules(trainingId, defaultSchedule.moduleRules)
    } else {
      const nextDays = Array.isArray(body.schedule_days)
        ? normalizeScheduleDays(body.schedule_days as CampScheduleDay[])
        : (await loadTrainingScheduleConfig(trainingId)).days

      if (Array.isArray(body.modules)) {
        for (const row of body.modules as Array<{
          module_id: number
          schedule_day?: number | null
          schedule_day_sort?: number
          is_visible?: boolean
        }>) {
          const moduleId = Number(row.module_id)
          if (!Number.isFinite(moduleId)) continue

          const modRows = asSqlRows<{ training_id: number }>(await sql`
            SELECT p.training_id
            FROM camp_modules m
            JOIN camp_projects p ON p.id = m.project_id
            WHERE m.id = ${moduleId}
            LIMIT 1
          `)
          if (modRows.length === 0 || Number(modRows[0].training_id) !== trainingId) continue

          await sql`
            UPDATE camp_modules
            SET
              schedule_day = ${row.schedule_day ?? null},
              schedule_day_sort = COALESCE(${row.schedule_day_sort ?? null}, schedule_day_sort),
              is_visible = COALESCE(${row.is_visible ?? null}, is_visible),
              updated_at = NOW()
            WHERE id = ${moduleId}
          `
        }
      }

      const modulesAfterPatch = await loadCurriculumModulesForTraining(trainingId)
      const derivedRules = buildScheduleRulesFromModuleAssignments(
        modulesAfterPatch.map((m) => ({
          title: m.title,
          schedule_day: m.schedule_day,
          schedule_day_sort: m.schedule_day_sort,
        })),
      )

      const nextRules = Array.isArray(body.schedule_module_rules)
        ? normalizeScheduleModuleRules(body.schedule_module_rules as CampModuleScheduleRule[])
        : derivedRules

      await saveTrainingScheduleConfig(trainingId, {
        days: nextDays,
        moduleRules: nextRules.length > 0 ? nextRules : derivedRules,
      })
    }

    const renumberTitles = body.renumber_titles === true
    const result = await applyCampModuleSchedule(trainingId, { renumberTitles })

    const modules = sortCampModulesBySchedule(await loadCurriculumModulesForTraining(trainingId))
    const scheduleConfig = await loadTrainingScheduleConfig(trainingId)

    return NextResponse.json({
      ...result,
      modules,
      schedule_days: scheduleConfig.days,
      schedule_module_rules: scheduleConfig.moduleRules,
      default_schedule: defaultSchedule,
      training_slug: slug,
    })
  } catch (error) {
    console.error("[instructor/summer-camp/modules/schedule PUT]", error)
    return NextResponse.json({ error: "Failed to save module schedule" }, { status: 500 })
  }
}
