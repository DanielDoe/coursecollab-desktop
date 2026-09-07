import { sql } from "@/lib/db"

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`
}

/** Disable triggers on lecture_student_progress (avoids update_profile_after_lecture cast errors). */
export async function disableLectureProgressTriggers() {
  const triggers = await sql`
    SELECT tgname::text AS name
    FROM pg_trigger
    WHERE tgrelid = 'public.lecture_student_progress'::regclass
      AND NOT tgisinternal
  `
  for (const t of triggers as { name: string }[]) {
    const stmt = `ALTER TABLE lecture_student_progress DISABLE TRIGGER ${quoteIdent(t.name)}`
    try {
      await sql`${sql.unsafe(stmt)}`
    } catch (e) {
      console.warn(`[lecture-progress] Could not disable trigger ${t.name}:`, e)
    }
  }
}

export async function enableLectureProgressTriggers() {
  const triggers = await sql`
    SELECT tgname::text AS name
    FROM pg_trigger
    WHERE tgrelid = 'public.lecture_student_progress'::regclass
      AND NOT tgisinternal
  `
  for (const t of triggers as { name: string }[]) {
    const stmt = `ALTER TABLE lecture_student_progress ENABLE TRIGGER ${quoteIdent(t.name)}`
    try {
      await sql`${sql.unsafe(stmt)}`
    } catch (e) {
      console.warn(`[lecture-progress] Could not enable trigger ${t.name}:`, e)
    }
  }
}

export async function withLectureProgressTriggersDisabled<T>(fn: () => Promise<T>): Promise<T> {
  await disableLectureProgressTriggers()
  try {
    return await fn()
  } finally {
    await enableLectureProgressTriggers()
  }
}
