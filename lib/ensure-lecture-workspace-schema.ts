import { sql } from "@/lib/db"

let ensured = false

/** Ensure lectures.lecture_workspace exists (migration may not have run on all deployments). */
export async function ensureLectureWorkspaceSchema(): Promise<void> {
  if (ensured) return

  await sql`
    ALTER TABLE lectures
    ADD COLUMN IF NOT EXISTS lecture_workspace JSONB DEFAULT NULL
  `

  ensured = true
}
