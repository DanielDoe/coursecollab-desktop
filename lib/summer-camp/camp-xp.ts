import { sql } from "@/lib/db"
import { getCamperProfile, MODULE_COMPLETION_XP } from "@/lib/summer-camp/camper-profile"
import { computeActivityEngagementXp } from "@/lib/summer-camp/camp-activity-xp"

async function computeModuleCompletionXp(
  studentDbId: number,
  trainingId?: number,
): Promise<number> {
  const rows = trainingId != null
    ? await sql`
        SELECT m.sort_order
        FROM camp_progress cp
        JOIN camp_modules m ON m.id = cp.module_id
        JOIN camp_projects pr ON pr.id = m.project_id
        WHERE cp.student_id = ${studentDbId}
          AND cp.progress_type = 'module_complete'
          AND pr.training_id = ${trainingId}
      `
    : await sql`
        SELECT m.sort_order
        FROM camp_progress cp
        JOIN camp_modules m ON m.id = cp.module_id
        WHERE cp.student_id = ${studentDbId}
          AND cp.progress_type = 'module_complete'
      `
  let total = 0
  for (const row of rows) {
    const sortOrder = Number((row as { sort_order: number }).sort_order)
    total += MODULE_COMPLETION_XP[sortOrder] ?? 25
  }
  return total
}

/** XP from completed modules plus engagement (quizzes, uploads, steps, etc.). */
export async function computeCampXpFromProgress(
  studentDbId: number,
  trainingId?: number,
): Promise<number> {
  const moduleXp = await computeModuleCompletionXp(studentDbId, trainingId)
  const activityXp = await computeActivityEngagementXp(studentDbId, trainingId)
  return moduleXp + activityXp
}

/** Keep camp_camper_profiles.total_xp aligned with modules + activity engagement. */
export async function syncCampCamperXp(studentDbId: number): Promise<{
  total_xp: number
  synced: boolean
  modules_completed: number
}> {
  const computed = await computeCampXpFromProgress(studentDbId)
  const moduleCountRows = await sql`
    SELECT COUNT(DISTINCT module_id)::int AS c
    FROM camp_progress
    WHERE student_id = ${studentDbId} AND progress_type = 'module_complete'
  `
  const modulesCompleted = Number(moduleCountRows[0]?.c ?? 0)

  const existing = await getCamperProfile(studentDbId)
  const finalXp = Math.max(existing.total_xp, computed)
  if (existing.total_xp !== finalXp) {
    await sql`
      INSERT INTO camp_camper_profiles (student_id, profile, total_xp, badges)
      VALUES (${studentDbId}, ${JSON.stringify(existing.profile)}::jsonb, ${finalXp}, ${JSON.stringify(existing.badges)}::jsonb)
      ON CONFLICT (student_id) DO UPDATE SET
        total_xp = ${finalXp},
        updated_at = NOW()
    `
    return { total_xp: finalXp, synced: true, modules_completed: modulesCompleted }
  }
  return { total_xp: finalXp, synced: false, modules_completed: modulesCompleted }
}

export function xpForModuleSortOrder(sortOrder: number): number {
  return MODULE_COMPLETION_XP[sortOrder] ?? 25
}

export function formatCampDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "Camper"
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`
}
