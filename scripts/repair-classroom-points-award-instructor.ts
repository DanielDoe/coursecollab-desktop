/**
 * Re-attribute classroom point awards to the student's course instructor.
 *
 *   npx tsx scripts/repair-classroom-points-award-instructor.ts
 *   CONFIRM=yes npx tsx scripts/repair-classroom-points-award-instructor.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"

async function main() {
  const preview = (await sql`
    SELECT
      cp.id,
      cp.student_id,
      cp.reason,
      cp.awarded_by AS current_awarded_by,
      i_wrong.name AS current_instructor,
      c.instructor_id AS course_instructor_id,
      i_right.name AS course_instructor
    FROM classroom_points cp
    JOIN students s ON s.id = cp.student_id
    JOIN courses c ON c.id = COALESCE(
      s.course_id,
      (SELECT sess.course_id FROM sessions sess WHERE sess.id = s.session_id)
    )
    LEFT JOIN instructors i_wrong ON i_wrong.id = cp.awarded_by
    LEFT JOIN instructors i_right ON i_right.id = c.instructor_id
    WHERE c.instructor_id IS NOT NULL
      AND cp.awarded_by IS DISTINCT FROM c.instructor_id
      AND cp.category IN ('code_submission', 'solution_submission')
    ORDER BY cp.id DESC
    LIMIT 50
  `) as Array<{
    id: number
    student_id: number
    reason: string | null
    current_awarded_by: number | null
    current_instructor: string | null
    course_instructor_id: number
    course_instructor: string | null
  }>

  console.log(`Mismatched classroom awards: ${preview.length}${preview.length === 50 ? "+" : ""}`)
  for (const row of preview.slice(0, 12)) {
    console.log(
      `  #${row.id} student ${row.student_id} "${row.reason ?? ""}" awarded_by ${row.current_instructor ?? row.current_awarded_by} → ${row.course_instructor}`,
    )
  }

  if (process.env.CONFIRM !== "yes") {
    console.log("Dry run. Re-run with CONFIRM=yes to apply.")
    return
  }

  const updated = await sql`
    UPDATE classroom_points cp
    SET awarded_by = c.instructor_id
    FROM students s
    JOIN courses c ON c.id = COALESCE(
      s.course_id,
      (SELECT sess.course_id FROM sessions sess WHERE sess.id = s.session_id)
    )
    WHERE cp.student_id = s.id
      AND c.instructor_id IS NOT NULL
      AND cp.awarded_by IS DISTINCT FROM c.instructor_id
      AND cp.category IN ('code_submission', 'solution_submission')
    RETURNING cp.id
  `
  console.log(`Updated ${updated.length} classroom_points rows.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
