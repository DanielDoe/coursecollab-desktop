import { sql } from "@/lib/db"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"

/** Resolves param to `students.id` only if the row is a platform guest. */
export async function requirePlatformGuestDatabaseId(raw: string): Promise<number | null> {
  const id = await resolveStudentDatabaseIdFromParam(raw)
  if (id == null) return null
  const rows = await sql`
    SELECT id FROM students WHERE id = ${id} AND COALESCE(is_platform_guest, false) = true LIMIT 1
  `
  return rows.length > 0 ? id : null
}
