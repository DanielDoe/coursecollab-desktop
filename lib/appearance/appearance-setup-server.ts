import { sql } from "@/lib/db"

/**
 * Stored in {student,instructor}_module_preferences — survives browser/device
 * changes. Summer campers and career members are rows in `students`, so the
 * student side covers three of the four audiences.
 */
export const APPEARANCE_SETUP_MODULE = "appearance_setup_v1"

export async function isAppearanceSetupCompleted(studentDbId: number): Promise<boolean> {
  const rows = await sql`
    SELECT is_favorite
    FROM student_module_preferences
    WHERE student_id = ${studentDbId}
      AND module_name = ${APPEARANCE_SETUP_MODULE}
    LIMIT 1
  `
  return rows.length > 0 && rows[0].is_favorite === true
}

export async function markAppearanceSetupCompleted(studentDbId: number): Promise<void> {
  await sql`
    INSERT INTO student_module_preferences (
      student_id,
      module_name,
      is_favorite,
      display_order,
      usage_count,
      last_accessed
    )
    VALUES (${studentDbId}, ${APPEARANCE_SETUP_MODULE}, true, 0, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (student_id, module_name)
    DO UPDATE SET
      is_favorite = true,
      last_accessed = CURRENT_TIMESTAMP
  `
}

/* ------------------------------------------------------------------ */
/* Instructors                                                         */
/*                                                                     */
/* Different table, different flag column: instructor_module_preferences
   uses `is_enabled` (DEFAULT true), not `is_favorite`. The default is
   why the read below tests the column explicitly instead of treating
   "a row exists" as completion — an unrelated module row must not be
   readable as a finished appearance setup.                             */
/* ------------------------------------------------------------------ */

export async function isInstructorAppearanceSetupCompleted(
  instructorId: number,
): Promise<boolean> {
  const rows = await sql`
    SELECT is_enabled
    FROM instructor_module_preferences
    WHERE instructor_id = ${instructorId}
      AND module_name = ${APPEARANCE_SETUP_MODULE}
    LIMIT 1
  `
  return rows.length > 0 && rows[0].is_enabled === true
}

export async function markInstructorAppearanceSetupCompleted(
  instructorId: number,
): Promise<void> {
  await sql`
    INSERT INTO instructor_module_preferences (
      instructor_id,
      module_name,
      is_enabled,
      last_accessed
    )
    VALUES (${instructorId}, ${APPEARANCE_SETUP_MODULE}, true, CURRENT_TIMESTAMP)
    ON CONFLICT (instructor_id, module_name)
    DO UPDATE SET
      is_enabled = true,
      last_accessed = CURRENT_TIMESTAMP
  `
}
