import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import type { StudentProgramRole } from "@/lib/summer-camp/types"
import { isSummerProgramRole, type SummerProgramRole } from "@/lib/summer-camp/program-roles"

export { isSummerProgramRole, hasSummerProgramAccess, summerProgramRoleLabel } from "@/lib/summer-camp/program-roles"

export async function getStudentProgramRole(studentDbId: number): Promise<StudentProgramRole> {
  const rows = await sql`
    SELECT
      COALESCE(student_program_role, 'regular') AS role,
      COALESCE(is_platform_guest, false) AS is_guest
    FROM students
    WHERE id = ${studentDbId}
    LIMIT 1
  `
  if (rows.length === 0) return "regular"
  const row = rows[0] as { role: string; is_guest: boolean }
  if (row.is_guest) return "platform_guest"
  if (isSummerProgramRole(row.role)) return row.role
  return "regular"
}

/** Session-bound summer camper. Header/body student IDs are never identity. */
export async function requireBoundSummerCamper(
  request: NextRequest,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireCallerStudentDbId(request)
  if (!caller.ok) return caller
  const camperId = await requireSummerCamperDatabaseId(String(caller.studentDbId))
  if (camperId == null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Summer camper access required" }, { status: 403 }),
    }
  }
  return { ok: true, studentDbId: camperId }
}

/** Resolves param to students.id if summer camper/student or has camp enrollment. */
export async function requireSummerCamperDatabaseId(raw: string): Promise<number | null> {
  const id = await resolveStudentDatabaseIdFromParam(raw)
  if (id == null) return null

  const role = await getStudentProgramRole(id)
  if (isSummerProgramRole(role)) return id

  const enrolled = await sql`
    SELECT 1 FROM camp_enrollments WHERE student_id = ${id} LIMIT 1
  `
  return enrolled.length > 0 ? id : null
}

export async function markStudentProgramRole(
  studentDbId: number,
  role: SummerProgramRole,
): Promise<void> {
  await sql`
    UPDATE students
    SET student_program_role = ${role}
    WHERE id = ${studentDbId}
  `
}

export async function markStudentAsSummerCamper(studentDbId: number): Promise<void> {
  await markStudentProgramRole(studentDbId, "summer_camper")
}

export async function markStudentAsSummerStudent(studentDbId: number): Promise<void> {
  await markStudentProgramRole(studentDbId, "summer_student")
}

/** Ensures a summer program role without downgrading summer_camper to summer_student. */
export async function ensureSummerProgramRole(
  studentDbId: number,
  preferred: SummerProgramRole = "summer_student",
): Promise<SummerProgramRole> {
  const current = await getStudentProgramRole(studentDbId)
  if (isSummerProgramRole(current)) return current
  await markStudentProgramRole(studentDbId, preferred)
  return preferred
}
