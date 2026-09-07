import { sql } from "@/lib/db"

let ensured = false

/** Student-selected question ids per section index for optional-pick section scoring. */
export async function ensureSectionQuestionSelectionSchema(): Promise<void> {
  if (ensured) return
  await sql`
    ALTER TABLE quiz_attempts
    ADD COLUMN IF NOT EXISTS section_question_selections JSONB
  `
  ensured = true
}
