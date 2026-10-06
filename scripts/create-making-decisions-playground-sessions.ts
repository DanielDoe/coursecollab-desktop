/**
 * Fall 2026 ELEG 130X playground sessions:
 * Making decisions (if/else statements) — Part 1 and Part 2.
 *
 * Same shape as the other lecture playground sessions (15s, closed until the
 * instructor opens the lobby). ELEG 1301 is split by section: P01 and P02 each
 * get their own Part 1 and Part 2. ELEG 1304 is P03 only.
 * Questions are existing Selection Criteria MCQs and true/false items only.
 *
 *   npx tsx scripts/create-making-decisions-playground-sessions.ts
 *   DRY_RUN=1 npx tsx scripts/create-making-decisions-playground-sessions.ts
 */
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

const DRY_RUN = /^(1|true|yes)$/i.test(String(process.env.DRY_RUN ?? ""))
const TITLE = "Making decisions (if/else statements)"
const BANK_TOPIC = "Selection Criteria (if, else-if, switch)"
const DURATION_SEC = 15
const INSTRUCTOR_ID = 1

const SECTIONS = [
  { courseId: 5, sectionCode: "ELEG1301P01" },
  { courseId: 5, sectionCode: "ELEG1301P02" },
  { courseId: 6, sectionCode: "ELEG1304P03" },
] as const

/** Part 1: comparison and simple if / else-if. Part 2: nesting, bugs, and chained ifs. */
const PARTS: Array<{ part: 1 | 2; questionIds: number[] }> = [
  {
    part: 1,
    questionIds: [233, 584, 586, 582, 585, 264, 855, 859, 882, 857],
  },
  {
    part: 2,
    questionIds: [588, 591, 595, 598, 600, 853, 856, 862, 870, 884],
  },
]

type BankRow = {
  id: number
  question_type: string
  question_text: string
  options: unknown
  correct_answer: unknown
}

function optionCount(options: unknown): number {
  return Array.isArray(options) ? options.length : 0
}

function answerPresent(value: unknown): boolean {
  if (value == null) return false
  const text = typeof value === "string" ? value.trim() : JSON.stringify(value)
  return text.length > 0 && text !== "null" && text !== '""'
}

async function main() {
  const { sql } = await import("../lib/db")

  const ids = PARTS.flatMap((part) => part.questionIds)
  const bank = (await sql`
    SELECT id, question_type, question_text, options, correct_answer
    FROM question_bank
    WHERE deleted_at IS NULL
      AND course_id = 6
      AND topic = ${BANK_TOPIC}
      AND id = ANY(${ids})
  `) as BankRow[]

  const byId = new Map(bank.map((row) => [row.id, row]))
  for (const part of PARTS) {
    const types = part.questionIds.map((id) => byId.get(id)?.question_type)
    const mcq = types.filter((type) => type === "mcq").length
    const tf = types.filter((type) => type === "true_false").length
    if (mcq !== 5 || tf !== 5 || part.questionIds.length !== 10) {
      throw new Error(`Part ${part.part} must be 5 MCQ and 5 true/false. Got ${mcq} MCQ, ${tf} T/F.`)
    }
    for (const id of part.questionIds) {
      const row = byId.get(id)
      if (!row) throw new Error(`Question ${id} is missing from the ${BANK_TOPIC} bank.`)
      if (optionCount(row.options) < 2) throw new Error(`Question ${id} has fewer than 2 options.`)
      if (!answerPresent(row.correct_answer)) throw new Error(`Question ${id} has no correct answer.`)
    }
  }

  for (const part of PARTS) {
    console.log(`\nPart ${part.part}`)
    part.questionIds.forEach((id, index) => {
      const row = byId.get(id)!
      console.log(
        `${index + 1}. [${row.question_type}] #${id} ${row.question_text.replace(/\s+/g, " ").slice(0, 110)}`,
      )
    })
  }

  if (DRY_RUN) {
    console.log("\nDry run — no sessions created.")
    return
  }

  const sectionRows = (await sql`
    SELECT id, code, course_id
    FROM sessions
    WHERE academic_term_id = 70
      AND TRIM(code) IN ('ELEG1301P01', 'ELEG1301P02', 'ELEG1304P03')
  `) as { id: number; code: string; course_id: number }[]
  const sectionIdByCode = new Map(sectionRows.map((row) => [row.code, row.id]))

  for (const section of SECTIONS) {
    const sectionId = sectionIdByCode.get(section.sectionCode)
    if (!sectionId) throw new Error(`Fall 2026 section ${section.sectionCode} was not found.`)

    for (const part of PARTS) {
      const label = `${TITLE} — Part ${part.part} (${section.sectionCode})`
      const topics = [label, BANK_TOPIC]
      const sharedLabel = `${TITLE} — Part ${part.part}`

      const existing = (await sql`
        SELECT id, session_code, selected_topics
        FROM playground_sessions
        WHERE mode = 'CLASSROOM'
          AND course_id = ${section.courseId}
          AND (
            selected_topics[1] = ${label}
            OR (
              selected_topics[1] = ${sharedLabel}
              AND (
                allowed_sessions IS NULL
                OR cardinality(allowed_sessions) = 0
                OR ${sectionId} = ANY(allowed_sessions)
              )
            )
          )
        ORDER BY CASE WHEN selected_topics[1] = ${label} THEN 0 ELSE 1 END, id
        LIMIT 1
      `) as { id: number; session_code: string; selected_topics: string[] }[]

      if (existing.length > 0) {
        const row = existing[0]!
        await sql`
          UPDATE playground_sessions
          SET selected_topics = ${topics},
              allowed_sessions = ${[sectionId]}
          WHERE id = ${row.id}
        `
        console.log(`scoped ${section.sectionCode} ${row.session_code} ${label}`)
        continue
      }

      const inserted = (await sql`
        INSERT INTO playground_sessions (
          mode, duration_sec, is_active, selected_topics, question_count,
          current_question_index, allowed_sessions, course_id, instructor_id,
          game_started
        )
        VALUES (
          'CLASSROOM', ${DURATION_SEC}, false, ${topics}, ${part.questionIds.length},
          0, ${[sectionId]}, ${section.courseId}, ${INSTRUCTOR_ID},
          false
        )
        RETURNING id, session_code
      `) as { id: number; session_code: string }[]
      const session = inserted[0]
      if (!session?.id) throw new Error(`Failed to create ${section.sectionCode} ${label}`)

      for (let i = 0; i < part.questionIds.length; i++) {
        await sql`
          INSERT INTO playground_questions (session_id, bank_question_id, question_order)
          VALUES (${session.id}, ${part.questionIds[i]}, ${i + 1})
        `
      }

      const linked = (await sql`
        SELECT qb.question_type, COUNT(*)::int AS n
        FROM playground_questions pq
        JOIN question_bank qb ON qb.id = pq.bank_question_id
        WHERE pq.session_id = ${session.id}
          AND qb.question_type IN ('mcq', 'true_false')
          AND qb.deleted_at IS NULL
        GROUP BY qb.question_type
      `) as { question_type: string; n: number }[]
      console.log(`created ${section.sectionCode} ${session.session_code} ${label} ${JSON.stringify(linked)}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
