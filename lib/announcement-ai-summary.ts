import OpenAI from "openai"
import { sql } from "@/lib/db"
import { announcementPlainText } from "@/lib/announcement-content"
import { createForFeature } from "@/lib/resolve-feature-ai-model"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

const MAX_SUMMARY_CHARS = 320
const MAX_INPUT_CHARS = 12_000

export function fallbackAnnouncementSummary(title: string, content: string): string {
  const plain = announcementPlainText(content, MAX_INPUT_CHARS)
  if (!plain.trim()) {
    return `Update: ${title.trim()}`.slice(0, MAX_SUMMARY_CHARS)
  }

  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)

  const keywords =
    /\b(due|deadline|submit|exam|quiz|homework|class|cancel|required|must|please|remember|important|attendance|final|midterm)\b/i
  const priority = sentences.filter((s) => keywords.test(s))
  let summary = ""
  if (priority.length >= 2) {
    summary = `${priority[0]} ${priority[1]}`
  } else if (priority.length === 1) {
    summary = priority[0]
  } else if (sentences.length >= 2) {
    summary = `${sentences[0]} ${sentences[1]}`
  } else {
    summary = sentences[0] ?? plain
  }

  if (summary.length > MAX_SUMMARY_CHARS) {
    return `${summary.slice(0, MAX_SUMMARY_CHARS - 1).trim()}…`
  }
  return summary.trim()
}

/** Generate a concise student-facing summary (mobile feed + dashboard cards). */
export async function generateAnnouncementAiSummary(params: {
  title: string
  content: string
}): Promise<string> {
  const title = params.title.trim()
  const plain = announcementPlainText(params.content, MAX_INPUT_CHARS)

  if (!plain.trim()) {
    return fallbackAnnouncementSummary(title, params.content)
  }

  if (!openai) {
    return fallbackAnnouncementSummary(title, params.content)
  }

  try {
    const { content } = await createForFeature(openai, "announcement_summary", {
      messages: [
        {
          role: "system",
          content:
            "You write concise course announcement summaries for students scanning a mobile feed. " +
            `Return 1–3 plain sentences (max ${MAX_SUMMARY_CHARS} characters total). ` +
            "Lead with deadlines, required actions, policy changes, and dates. " +
            "No markdown, bullets, HTML, or invented details.",
        },
        {
          role: "user",
          content: `Title: ${title}\n\nAnnouncement:\n${plain}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 220,
    })

    const summary = String(content || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/^["']|["']$/g, "")

    if (summary.length >= 20) {
      return summary.length > MAX_SUMMARY_CHARS
        ? `${summary.slice(0, MAX_SUMMARY_CHARS - 1).trim()}…`
        : summary
    }
  } catch (err) {
    console.warn("[announcement-ai-summary] AI generation failed, using fallback:", err)
  }

  return fallbackAnnouncementSummary(title, params.content)
}

/** Persist ai_summary for an announcement row. */
export async function saveAnnouncementAiSummary(
  announcementId: number,
  aiSummary: string,
): Promise<void> {
  await sql`
    UPDATE announcements
    SET ai_summary = ${aiSummary}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${announcementId}
  `
}

/** Generate and persist summary from title + body. */
export async function generateAndSaveAnnouncementAiSummary(params: {
  announcementId: number
  title: string
  content: string
}): Promise<string> {
  const aiSummary = await generateAnnouncementAiSummary({
    title: params.title,
    content: params.content,
  })
  await saveAnnouncementAiSummary(params.announcementId, aiSummary)
  return aiSummary
}

/** Backfill a small batch of announcements missing ai_summary (called from GET). */
export async function backfillAnnouncementAiSummaries(limit = 8): Promise<number> {
  const rows = await sql<{ id: number; title: string; content: string }[]>`
    SELECT id, title, content
    FROM announcements
    WHERE ai_summary IS NULL OR TRIM(ai_summary) = ''
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  for (const row of rows) {
    await generateAndSaveAnnouncementAiSummary({
      announcementId: row.id,
      title: row.title,
      content: row.content,
    })
  }

  return rows.length
}
