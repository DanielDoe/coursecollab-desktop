import { sql } from "@/lib/db"
import {
  PLAYGROUND_LEARNING_PROFILE_FN_SQL,
  PLAYGROUND_PROFILE_TRIGGER_SQL,
} from "@/lib/playground-learning-profile-sql"

let ensured = false

/** Keep the playground completion trigger from casting a login like "pbyrd4" to an integer. */
export async function ensurePlaygroundLearningProfile(): Promise<void> {
  if (ensured) return
  await sql`${sql.unsafe(PLAYGROUND_LEARNING_PROFILE_FN_SQL)}`
  await sql`${sql.unsafe(PLAYGROUND_PROFILE_TRIGGER_SQL)}`
  ensured = true
}
