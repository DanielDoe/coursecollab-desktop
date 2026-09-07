import { sql } from "@/lib/db"

function isMissingRelation(err: unknown): boolean {
  const e = err as { code?: string; message?: string }
  return e.code === "42P01" || e.code === "42703" || /does not exist/i.test(String(e.message ?? ""))
}

async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    if (isMissingRelation(err)) return
    console.error(`[purge-owned-course] ${label}`, err)
    throw err
  }
}

function idList(rows: unknown): number[] {
  return (rows as { id?: unknown }[])
    .map((r) => Number(r.id))
    .filter((n) => Number.isFinite(n) && n > 0)
}

/**
 * Permanently delete a faculty-owned course and its roster/content.
 * Does not delete other instructors' destination copies; exchange copy rows are dropped.
 */
export async function purgeOwnedCourse(courseId: number): Promise<void> {
  if (!Number.isFinite(courseId) || courseId < 1) {
    throw new Error("Invalid course")
  }

  const sessionRows = await sql`SELECT id FROM sessions WHERE course_id = ${courseId}`
  const sessionIds = idList(sessionRows)
  const studentRows = await sql`
    SELECT id FROM students
    WHERE course_id = ${courseId}
       OR (${sessionIds}::int[] <> '{}'::int[] AND session_id = ANY(${sessionIds}::int[]))
  `
  const studentIds = idList(studentRows)

  await run("course_exchange_copies", () => sql`
    DELETE FROM course_exchange_copies
    WHERE source_course_id = ${courseId} OR destination_course_id = ${courseId}
  `)
  await run("syllabus_exchange_copies", () => sql`
    DELETE FROM syllabus_exchange_copies
    WHERE source_course_id = ${courseId} OR destination_course_id = ${courseId}
  `)

  if (studentIds.length > 0) {
    await run("ai_tutor_filter_violations", () => sql`
      DELETE FROM ai_tutor_filter_violations WHERE student_id = ANY(${studentIds}::int[])
    `)
    await run("question_embeddings", () => sql`
      DELETE FROM question_embeddings WHERE student_id = ANY(${studentIds}::int[])
    `)
    await run("ai_evaluation_config", () => sql`
      DELETE FROM ai_evaluation_config WHERE created_by = ANY(${studentIds}::int[])
    `)
    await run("project_presentations", () => sql`
      DELETE FROM project_presentations WHERE created_by = ANY(${studentIds}::int[])
    `)
  }

  await run("attendance_records", () => sql`
    DELETE FROM attendance_records
    WHERE session_id IN (SELECT id FROM attendance_sessions WHERE course_id = ${courseId})
  `)
  await run("attendance_sessions", () => sql`
    DELETE FROM attendance_sessions WHERE course_id = ${courseId}
  `)
  await run("account_requests", () => sql`
    DELETE FROM account_requests WHERE course_id = ${courseId}
  `)
  await run("cora_agent_runs", () => sql`DELETE FROM cora_agent_runs WHERE course_id = ${courseId}`)
  await run("cora_usage_events", () => sql`DELETE FROM cora_usage_events WHERE course_id = ${courseId}`)
  await run("cora_user_memory", () => sql`DELETE FROM cora_user_memory WHERE course_id = ${courseId}`)
  await run("institution_cora_usage", () => sql`DELETE FROM institution_cora_usage WHERE course_id = ${courseId}`)
  await run("instructor_cora_automations", () => sql`DELETE FROM instructor_cora_automations WHERE course_id = ${courseId}`)
  await run("instructor_cora_playbooks", () => sql`DELETE FROM instructor_cora_playbooks WHERE course_id = ${courseId}`)
  await run("instructor_cora_threads", () => sql`DELETE FROM instructor_cora_threads WHERE course_id = ${courseId}`)
  await run("student_progress_reviews", () => sql`DELETE FROM student_progress_reviews WHERE course_id = ${courseId}`)
  await run("practice_configs", () => sql`DELETE FROM practice_configs WHERE course_id = ${courseId}`)

  await run("playground_sessions", () => sql`DELETE FROM playground_sessions WHERE course_id = ${courseId}`)
  await run("lectures", () => sql`DELETE FROM lectures WHERE course_id = ${courseId}`)
  await run("quizzes", () => sql`DELETE FROM quizzes WHERE course_id = ${courseId}`)
  await run("question_bank", () => sql`DELETE FROM question_bank WHERE course_id = ${courseId}`)
  await run("announcements", () => sql`DELETE FROM announcements WHERE course_id = ${courseId}`)
  await run("course_schedule_versions", () => sql`DELETE FROM course_schedule_versions WHERE course_id = ${courseId}`)
  await run("schedule_adjustment_requests", () => sql`DELETE FROM schedule_adjustment_requests WHERE course_id = ${courseId}`)
  await run("projects", () => sql`DELETE FROM projects WHERE course_id = ${courseId}`)
  await run("groups", () => sql`DELETE FROM groups WHERE course_id = ${courseId}`)

  if (studentIds.length > 0) {
    await run("students", () => sql`DELETE FROM students WHERE id = ANY(${studentIds}::int[])`)
  }
  await run("students-by-course", () => sql`DELETE FROM students WHERE course_id = ${courseId}`)
  await run("sessions", () => sql`DELETE FROM sessions WHERE course_id = ${courseId}`)
  await sql`DELETE FROM courses WHERE id = ${courseId}`
}
