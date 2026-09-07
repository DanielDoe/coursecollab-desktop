import { sql } from "@/lib/db"
import OpenAI from "openai"
import { createWithFallback } from "@/lib/openai-with-fallback"
import { ensureFlashcardSchema } from "@/lib/flashcards"

export type FacultyAutomationJobType = "weekly_announcement" | "post_lecture_flashcards"

export type FacultyAutomationJob = {
  id: number
  courseId: number
  instructorId: number
  jobType: FacultyAutomationJobType
  payload: Record<string, unknown>
  runAt: string
  status: "pending" | "running" | "completed" | "failed"
  lastError: string | null
  createdAt: string
  completedAt: string | null
}

let schemaReady: Promise<void> | null = null

export function ensureFacultyCoraAutomationsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = sql`
      CREATE TABLE IF NOT EXISTS instructor_cora_automations (
        id SERIAL PRIMARY KEY,
        course_id INTEGER NOT NULL,
        instructor_id INTEGER NOT NULL,
        job_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        run_at TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `.then(() => undefined)
  }
  return schemaReady
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

export async function createFacultyAutomationJob(input: {
  courseId: number
  instructorId: number
  jobType: FacultyAutomationJobType
  payload: Record<string, unknown>
  runAt: Date
}): Promise<FacultyAutomationJob> {
  await ensureFacultyCoraAutomationsSchema()
  const rows = await sql`
    INSERT INTO instructor_cora_automations (course_id, instructor_id, job_type, payload, run_at)
    VALUES (
      ${input.courseId},
      ${input.instructorId},
      ${input.jobType},
      ${JSON.stringify(input.payload)}::jsonb,
      ${input.runAt.toISOString()}
    )
    RETURNING *
  `
  return mapRow(rows[0] as Record<string, unknown>)
}

export async function listFacultyAutomationJobs(
  courseId: number,
  limit = 20,
): Promise<FacultyAutomationJob[]> {
  await ensureFacultyCoraAutomationsSchema()
  const rows = await sql`
    SELECT * FROM instructor_cora_automations
    WHERE course_id = ${courseId}
    ORDER BY run_at DESC
    LIMIT ${limit}
  `
  return rows.map((row) => mapRow(row as Record<string, unknown>))
}

function mapRow(row: Record<string, unknown>): FacultyAutomationJob {
  return {
    id: Number(row.id),
    courseId: Number(row.course_id),
    instructorId: Number(row.instructor_id),
    jobType: String(row.job_type) as FacultyAutomationJobType,
    payload: (row.payload as Record<string, unknown>) ?? {},
    runAt: String(row.run_at),
    status: String(row.status) as FacultyAutomationJob["status"],
    lastError: row.last_error != null ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
  }
}

async function draftWeeklyAnnouncement(payload: Record<string, unknown>): Promise<string> {
  const topic = String(payload.topic ?? "course update")
  if (!openai) {
    return `Weekly update: We will focus on ${topic} this week. Review lecture notes and complete assigned practice before Friday.`
  }
  const { content } = await createWithFallback(openai, {
    model: process.env.OPENAI_DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content: "Draft a concise weekly course announcement for instructors. Plain text, friendly, under 120 words.",
      },
      { role: "user", content: `Topic focus: ${topic}. Notes: ${String(payload.notes ?? "")}` },
    ],
    temperature: 0.4,
    max_tokens: 350,
  })
  return String(content ?? "").trim()
}

async function runPostLectureFlashcards(
  courseId: number,
  instructorId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  await ensureFlashcardSchema()
  const topic = String(payload.topic ?? "Lecture review").trim()
  const title = String(payload.deckTitle ?? `${topic} flashcards`).trim()
  const deckRows = await sql`
    INSERT INTO flashcard_decks (
      title, description, deck_kind, course_id, instructor_id, topic, is_published
    )
    VALUES (
      ${title}, ${""}, ${"course"}, ${courseId}, ${instructorId}, ${topic}, false
    )
    RETURNING id
  `
  const deckId = Number((deckRows[0] as { id: number }).id)
  const cardPrompt = String(payload.cardPrompt ?? `Key terms from ${topic}`)
  let cards: Array<{ front: string; back: string }> = [
    { front: `${topic} — concept 1`, back: "Review lecture notes" },
  ]
  if (openai) {
    const { content } = await createWithFallback(openai, {
      model: process.env.OPENAI_DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: {"cards":[{"front":"string","back":"string"}]} with 5-8 flashcards.',
        },
        { role: "user", content: cardPrompt },
      ],
      temperature: 0.35,
      max_tokens: 900,
    })
    try {
      const parsed = JSON.parse(String(content ?? "{}")) as {
        cards?: Array<{ front?: string; back?: string }>
      }
      if (Array.isArray(parsed.cards) && parsed.cards.length) {
        cards = parsed.cards
          .filter((c) => c.front && c.back)
          .map((c) => ({ front: String(c.front), back: String(c.back) }))
      }
    } catch {
      // keep fallback card
    }
  }
  for (let i = 0; i < cards.length; i += 1) {
    await sql`
      INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order)
      VALUES (${deckId}, ${cards[i].front}, ${cards[i].back}, ${i + 1})
    `
  }
  await sql`
    UPDATE flashcard_decks
    SET card_count = ${cards.length}, updated_at = NOW()
    WHERE id = ${deckId}
  `
}

async function runWeeklyAnnouncement(
  courseId: number,
  _instructorId: number,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = await draftWeeklyAnnouncement(payload)
  const title = String(payload.title ?? "Weekly course update")
  await sql`
    INSERT INTO announcements (
      title, content, type, priority, target_session, is_active, created_at, updated_at
    )
    VALUES (
      ${title}, ${body}, ${"info"}, ${"medium"}, ${"all"}, true, NOW(), NOW()
    )
  `
}

export async function runDueFacultyAutomations(limit = 10): Promise<{
  processed: number
  completed: number
  failed: number
  errors: string[]
}> {
  await ensureFacultyCoraAutomationsSchema()
  const due = await sql`
    SELECT * FROM instructor_cora_automations
    WHERE status = 'pending' AND run_at <= NOW()
    ORDER BY run_at ASC
    LIMIT ${limit}
  `

  let completed = 0
  let failed = 0
  const errors: string[] = []

  for (const row of due) {
    const job = mapRow(row as Record<string, unknown>)
    await sql`UPDATE instructor_cora_automations SET status = 'running' WHERE id = ${job.id}`
    try {
      if (job.jobType === "weekly_announcement") {
        await runWeeklyAnnouncement(job.courseId, job.instructorId, job.payload)
      } else if (job.jobType === "post_lecture_flashcards") {
        await runPostLectureFlashcards(job.courseId, job.instructorId, job.payload)
      } else {
        throw new Error(`Unknown job type: ${job.jobType}`)
      }
      await sql`
        UPDATE instructor_cora_automations
        SET status = 'completed', completed_at = NOW(), last_error = NULL
        WHERE id = ${job.id}
      `
      completed += 1
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Job ${job.id}: ${msg}`)
      await sql`
        UPDATE instructor_cora_automations
        SET status = 'failed', last_error = ${msg}
        WHERE id = ${job.id}
      `
      failed += 1
    }
  }

  return { processed: due.length, completed, failed, errors }
}
