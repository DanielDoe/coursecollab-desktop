/**
 * Attach locked worked solutions to Fall 2026 live classroom questions.
 * Does not start a broadcast and does not reset created_at.
 *
 *   npx tsx scripts/attach-classroom-worked-solutions.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { sql } from "@/lib/db"
import { FALL_2026_ELEG_SESSION_CODES } from "@/lib/eleg-fall-2026-student-scope"
import { CLASSROOM_WORKED_SOLUTIONS } from "@/scripts/classroom-worked-solutions"

function mergeSolution(existing: unknown, code: string): Record<string, unknown> {
  const record =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  const current =
    typeof record.reference_answer === "string" ? record.reference_answer.trim() : ""
  if (!current) record.reference_answer = code
  if (record.solution_unlocked !== true) record.solution_unlocked = false
  return record
}

async function main() {
  await sql`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`

  const titles = Object.keys(CLASSROOM_WORKED_SOLUTIONS)
  const rows = (await sql`
    SELECT id, title, question_config
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND title = ANY(${titles})
    ORDER BY id
  `) as { id: number; title: string; question_config: unknown }[]

  let attached = 0
  let locked = 0
  for (const row of rows) {
    const code = CLASSROOM_WORKED_SOLUTIONS[row.title]
    if (!code) continue
    const next = mergeSolution(row.question_config, code)
    await sql`
      UPDATE classroom_point_submissions
      SET question_config = ${JSON.stringify(next)}::jsonb
      WHERE id = ${row.id}
    `
    attached += 1
    if (next.solution_unlocked !== true) locked += 1
  }

  const missing = (await sql`
    SELECT DISTINCT title
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND LOWER(COALESCE(submission_kind, 'code')) = 'code'
      AND COALESCE(question_config ->> 'reference_answer', '') = ''
      AND COALESCE(question_config ->> 'sample_solution', '') = ''
    ORDER BY title
  `) as { title: string }[]

  const unlocked = (await sql`
    SELECT COUNT(*)::int AS n
    FROM classroom_point_submissions
    WHERE TRIM(session) = ANY(${FALL_2026_ELEG_SESSION_CODES})
      AND (question_config ->> 'solution_unlocked') = 'true'
  `) as { n: number }[]

  console.log(`updated ${attached} assignments, locked ${locked}`)
  console.log(`still missing a solution: ${missing.length}`)
  for (const row of missing) console.log(`  ${row.title}`)
  console.log(`unlocked solutions: ${unlocked[0]?.n ?? 0}`)
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
