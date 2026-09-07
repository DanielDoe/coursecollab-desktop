import { sql } from "@/lib/db"

let ensured = false

/** quiz_questions option/correct_answer columns were VARCHAR(255) on older deployments. */
export async function ensureQuizQuestionsTextColumns(): Promise<void> {
  if (ensured) return

  await sql`ALTER TABLE quiz_questions ALTER COLUMN correct_answer TYPE TEXT`
  await sql`ALTER TABLE quiz_questions ALTER COLUMN option_a TYPE TEXT`
  await sql`ALTER TABLE quiz_questions ALTER COLUMN option_b TYPE TEXT`
  await sql`ALTER TABLE quiz_questions ALTER COLUMN option_c TYPE TEXT`
  await sql`ALTER TABLE quiz_questions ALTER COLUMN option_d TYPE TEXT`
  await sql`ALTER TABLE quiz_questions ALTER COLUMN option_e TYPE TEXT`

  ensured = true
}
