import OpenAI from "openai"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import {
  fallbackNotificationSummary,
  MAX_INPUT_CHARS,
  MAX_SUMMARY_CHARS,
  truncate,
} from "@/lib/notification-ai-summary-shared"

export { fallbackNotificationSummary } from "@/lib/notification-ai-summary-shared"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

/** Generate a concise summary for notification center detail views. */
export async function generateNotificationAiSummary(params: {
  title: string
  message: string
  type?: string | null
}): Promise<string> {
  const title = params.title.trim()
  const message = params.message.trim().slice(0, MAX_INPUT_CHARS)

  if (!message) {
    return fallbackNotificationSummary(params)
  }

  if (!openai) {
    return fallbackNotificationSummary(params)
  }

  try {
    const typeHint = params.type?.replace(/_/g, " ") ?? "course update"
    const { content } = await createForFeature(openai, "notification_summary", {
      messages: [
        {
          role: "system",
          content:
            "You write concise notification summaries for a course platform notification center. " +
            `Return 1–3 plain sentences (max ${MAX_SUMMARY_CHARS} characters total). ` +
            "Lead with who did what, required instructor actions, deadlines, and next steps. " +
            "No markdown, bullets, HTML, or invented details.",
        },
        {
          role: "user",
          content: `Type: ${typeHint}\nTitle: ${title}\n\nNotification:\n${message}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 220,
    })

    const summary = String(content || "")
      .trim()
      .replace(/\s+/g, " ")

    if (!summary) return fallbackNotificationSummary(params)
    return truncate(summary)
  } catch (error) {
    console.error("[Notification AI Summary] generation failed:", error)
    return fallbackNotificationSummary(params)
  }
}

export async function saveInstructorNotificationAiSummary(
  notificationId: number,
  aiSummary: string,
): Promise<void> {
  await sql`
    UPDATE instructor_notifications
    SET ai_summary = ${aiSummary}
    WHERE id = ${notificationId}
  `
}

export async function saveStudentNotificationAiSummary(
  notificationId: number,
  aiSummary: string,
): Promise<void> {
  await sql`
    UPDATE notifications
    SET ai_summary = ${aiSummary}
    WHERE id = ${notificationId}
  `
}

/** Backfill a small batch of instructor rows missing ai_summary (called from GET). */
export async function backfillInstructorNotificationSummaries(limit = 8): Promise<void> {
  const rows = await sql<{ id: number; title: string; message: string; type: string }[]>`
    SELECT id, title, message, type
    FROM instructor_notifications
    WHERE ai_summary IS NULL OR TRIM(ai_summary) = ''
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  for (const row of rows) {
    const aiSummary = await generateNotificationAiSummary({
      title: row.title,
      message: row.message,
      type: row.type,
    })
    await saveInstructorNotificationAiSummary(row.id, aiSummary)
  }
}

/** Backfill a small batch of student rows missing ai_summary (called from GET). */
export async function backfillStudentNotificationSummaries(
  studentId: number,
  limit = 8,
): Promise<void> {
  const rows = await sql<{ id: number; title: string; message: string; type: string }[]>`
    SELECT id, title, message, type
    FROM notifications
    WHERE student_id = ${studentId}
      AND (ai_summary IS NULL OR TRIM(ai_summary) = '')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  for (const row of rows) {
    const aiSummary = await generateNotificationAiSummary({
      title: row.title,
      message: row.message,
      type: row.type,
    })
    await saveStudentNotificationAiSummary(row.id, aiSummary)
  }
}
