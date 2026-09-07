import { sql, asSqlRows } from "@/lib/db"
import { ensureSummerCampInstructorColumns } from "@/lib/ensure-summer-camp-instructor-columns"
import { isFacultyAssignedToTraining } from "@/lib/summer-camp/permissions"

export async function instructorOwnsCamp(instructorId: number, campId: number): Promise<boolean> {
  await ensureSummerCampInstructorColumns()
  const rows = asSqlRows(await sql`
    SELECT 1 FROM summer_camps
    WHERE id = ${campId} AND instructor_id = ${instructorId}
    LIMIT 1
  `)
  return rows.length > 0
}

export async function instructorCanManageCamp(instructorId: number, campId: number): Promise<boolean> {
  return instructorOwnsCamp(instructorId, campId)
}

export async function instructorCanManageTraining(
  instructorId: number,
  trainingId: number,
): Promise<boolean> {
  await ensureSummerCampInstructorColumns()
  const rows = asSqlRows<{ camp_id: number; camp_owner_id: number | null }>(await sql`
    SELECT t.camp_id, c.instructor_id AS camp_owner_id
    FROM camp_trainings t
    INNER JOIN summer_camps c ON c.id = t.camp_id
    WHERE t.id = ${trainingId}
    LIMIT 1
  `)
  if (rows.length === 0) return false
  const row = rows[0]
  if (row.camp_owner_id != null && Number(row.camp_owner_id) === instructorId) return true
  return isFacultyAssignedToTraining(instructorId, trainingId)
}
