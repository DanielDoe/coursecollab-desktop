/**
 * Create an open CodeBench live classroom assignment per Fall 2026 ELEG section
 * and start codebench_live_sessions so students can join from CodeBench.
 *
 *   npx tsx scripts/start-fall-2026-open-live-classroom.ts
 *   DRY_RUN=1 npx tsx scripts/start-fall-2026-open-live-classroom.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"
import { startLiveClassroomSession } from "@/lib/codebench-live-classroom"
import { ensureCodebenchLiveSessionsSchema } from "@/lib/codebench-live-session-schema"
import { CLASSROOM_SUBMISSION_KIND_CODE } from "@/lib/classroom-solution-submission"
import {
  FALL_2026_ELEG_SESSION_CODES,
  getFall2026ElegTermId,
} from "@/lib/eleg-fall-2026-student-scope"

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))

const ASSIGNMENT_TITLE = "Open Live Classroom — Fall 2026"
const ASSIGNMENT_DESCRIPTION = `Open CodeBench practice for Fall 2026.

Write and run C++ in the IDE. Your instructor can see live progress during class. Submit when you're ready for classroom points.

Starter task: write a program that reads your name and prints a welcome message.`

/** Keep assignment visible through end of Fall 2026 (Central). */
const DUE_AT = new Date("2026-12-15T23:59:59-06:00")

type SectionRow = {
  session_id: number
  session_code: string
  course_id: number
  instructor_id: number
  student_count: number
}

async function loadFallSections(): Promise<SectionRow[]> {
  const fallTermId = await getFall2026ElegTermId(sql)
  const rows = (await sql`
    SELECT
      sess.id AS session_id,
      TRIM(sess.code) AS session_code,
      sess.course_id,
      c.instructor_id,
      (
        SELECT COUNT(*)::int
        FROM students st
        WHERE st.session_id = sess.id
          AND st.deleted_at IS NULL
      ) AS student_count
    FROM sessions sess
    INNER JOIN courses c ON c.id = sess.course_id
    WHERE TRIM(sess.code) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND sess.academic_term_id = ${fallTermId}
      AND c.instructor_id IS NOT NULL
    ORDER BY sess.code ASC, sess.id ASC
  `) as SectionRow[]

  const byCode = new Map<string, SectionRow>()
  for (const row of rows) {
    const existing = byCode.get(row.session_code)
    if (!existing || row.student_count > existing.student_count) {
      byCode.set(row.session_code, row)
    }
  }
  return FALL_2026_ELEG_SESSION_CODES.map((code) => byCode.get(code)).filter(
    (row): row is SectionRow => Boolean(row),
  )
}

async function findOrCreateAssignment(section: SectionRow): Promise<number> {
  const existing = await sql`
    SELECT id, due_at
    FROM classroom_point_submissions
    WHERE TRIM(session) = ${section.session_code}
      AND title = ${ASSIGNMENT_TITLE}
      AND LOWER(COALESCE(submission_kind, 'code')) = ${CLASSROOM_SUBMISSION_KIND_CODE}
      AND COALESCE(hidden_from_students, false) = false
    ORDER BY id DESC
    LIMIT 1
  `
  if (existing.length > 0) {
    const id = Number((existing[0] as { id: number }).id)
    if (!DRY_RUN) {
      await sql`
        UPDATE classroom_point_submissions
        SET
          description = ${ASSIGNMENT_DESCRIPTION},
          due_at = ${DUE_AT},
          duration_hours = NULL
        WHERE id = ${id}
      `
    }
    return id
  }

  if (DRY_RUN) {
    console.log(`[dry-run] would create assignment for ${section.session_code}`)
    return -1
  }

  const inserted = await sql`
    INSERT INTO classroom_point_submissions (
      title,
      description,
      session,
      created_by,
      created_at,
      duration_hours,
      due_at,
      submission_kind,
      hidden_from_students
    ) VALUES (
      ${ASSIGNMENT_TITLE},
      ${ASSIGNMENT_DESCRIPTION},
      ${section.session_code},
      ${section.instructor_id},
      NOW(),
      NULL,
      ${DUE_AT},
      ${CLASSROOM_SUBMISSION_KIND_CODE},
      false
    )
    RETURNING id
  `
  return Number((inserted[0] as { id: number }).id)
}

async function main() {
  await ensureCodebenchLiveSessionsSchema()
  const sections = await loadFallSections()
  if (sections.length === 0) {
    throw new Error("No Fall 2026 ELEG sections found.")
  }

  console.log(`${DRY_RUN ? "[dry-run] " : ""}Open live classroom for Fall 2026 (${sections.length} sections)`)
  for (const section of sections) {
    console.log(
      `  ${section.session_code} · course ${section.course_id} · instructor ${section.instructor_id} · ${section.student_count} students`,
    )
  }

  for (const section of sections) {
    const assignmentId = await findOrCreateAssignment(section)
    if (assignmentId <= 0) continue

    if (DRY_RUN) {
      console.log(`[dry-run] would start live session assignmentId=${assignmentId} ${section.session_code}`)
      continue
    }

    const session = await startLiveClassroomSession({
      assignmentId,
      courseId: section.course_id,
      instructorId: section.instructor_id,
    })
    console.log(
      `✓ ${section.session_code}: assignment #${assignmentId} · live session #${session.sessionId} (started ${session.startedAt})`,
    )
  }

  console.log("\nStudents: CodeBench → join the live classroom banner for their section.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
