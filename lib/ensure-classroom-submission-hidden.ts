export async function ensureClassroomSubmissionHiddenColumn(sql: {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>
}): Promise<void> {
  await sql`
    ALTER TABLE classroom_point_submissions
    ADD COLUMN IF NOT EXISTS hidden_from_students BOOLEAN NOT NULL DEFAULT false
  `
  await sql`
    ALTER TABLE classroom_point_submissions
    ALTER COLUMN session TYPE VARCHAR(32)
  `
}
