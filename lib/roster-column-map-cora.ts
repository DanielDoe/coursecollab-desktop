import OpenAI from "openai"
import { createWithFallback } from "@/lib/openai-with-fallback"
import {
  EMPTY_ROSTER_COLUMN_MAPPING,
  type RosterColumnMapping,
} from "@/lib/roster-csv"
import { logCoraExternalAiCall, sanitizeMessagesForExternalAi } from "@/lib/cora/privacy/ai-data-minimization"

const FIELDS = [
  "student_id",
  "full_name",
  "sis_user_id",
  "sis_login_id",
  "canvas_section",
  "email",
] as const

export async function coraMapRosterColumns(
  headers: string[],
  samples: Record<string, string>[],
): Promise<{ mapping: RosterColumnMapping; notes: string }> {
  const fallback = { mapping: { ...EMPTY_ROSTER_COLUMN_MAPPING }, notes: "" }
  if (!process.env.OPENAI_API_KEY || headers.length === 0) return fallback

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const rawMessages = [
    {
      role: "system",
      content:
        "You are Cora, CourseCollab’s faculty copilot. Map CSV headers from a Canvas roster or Course Analytics Students export to CourseCollab student fields. Return JSON only.",
    },
    {
      role: "user",
      content: [
        "Target fields:",
        "- student_id: Canvas user id / student id (not required if email is present)",
        "- full_name: student display name (Canvas Analytics often uses Students)",
        "- sis_user_id: SIS user id",
        "- sis_login_id: SIS login / username",
        "- canvas_section: section name",
        "- email: email address",
        "",
        "Canvas Course Analytics → Students CSV typically has a name column (Students) and Email, plus Grade and participation columns to ignore.",
        "Use the exact header strings from the file. Use null when a field is not present.",
        "",
        "Headers:",
        JSON.stringify(headers),
        "",
        "Sample rows:",
        JSON.stringify(samples.slice(0, 4)),
        "",
        'Respond as {"mapping":{"student_id":null,"full_name":"...","email":"..."},"notes":"one sentence"}',
      ].join("\n"),
    },
  ]
  const messages = sanitizeMessagesForExternalAi(rawMessages)
  logCoraExternalAiCall({
    feature: "roster-column-map",
    messageCount: messages.length,
    promptChars: messages.reduce((n, m) => n + m.content.length, 0),
  })

  try {
    const { content } = await createWithFallback(openai, {
      model: process.env.OPENAI_DEFAULT_MODEL,
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: "json_object" },
      messages,
    })
    const parsed = JSON.parse(String(content ?? "{}")) as {
      mapping?: Record<string, string | null>
      notes?: string
    }
    const mapping = { ...EMPTY_ROSTER_COLUMN_MAPPING }
    const rawMap = parsed.mapping ?? {}
    for (const field of FIELDS) {
      const value = String(rawMap[field] ?? "").trim()
      if (value && headers.includes(value)) mapping[field] = value
    }
    return {
      mapping,
      notes: String(parsed.notes ?? "").trim(),
    }
  } catch {
    return fallback
  }
}
