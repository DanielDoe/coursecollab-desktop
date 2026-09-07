import OpenAI from "openai"
import { createWithFallback } from "@/lib/openai-with-fallback"
import { readNotetakerAudioIfExists } from "@/lib/ai-notetaker-storage"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

export type NotetakerKeyPoints = {
  shortSummary: string
  keyConcepts: string[]
  importantDefinitions: string[]
  actionItems: string[]
  possibleQuizQuestions: string[]
}

export async function transcribeAudioFile(params: {
  storageKey: string
  mimeType: string | null
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OpenAI is not configured for transcription.")
  const buf = await readNotetakerAudioIfExists(params.storageKey)
  if (!buf?.length) throw new Error("Audio file missing or empty.")

  const ext = params.storageKey.split(".").pop()?.toLowerCase() || "webm"
  const name = `lecture.${ext}`
  const form = new FormData()
  form.append("model", "whisper-1")
  form.append("response_format", "text")
  form.append(
    "file",
    new Blob([new Uint8Array(buf)], { type: params.mimeType || "application/octet-stream" }),
    name,
  )

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  })
  const raw = await res.text()
  if (!res.ok) {
    throw new Error(raw.slice(0, 500) || `Transcription failed (${res.status})`)
  }
  let out = raw.trim()
  if (out.startsWith("{")) {
    try {
      const j = JSON.parse(out) as { text?: string }
      out = String(j.text || "").trim()
    } catch {
      /* keep raw */
    }
  }
  if (!out) throw new Error("Transcription returned empty text.")
  return out
}

const SUMMARY_SCHEMA_HINT = `Return a single JSON object with keys:
"shortSummary" (string),
"keyConcepts" (array of strings),
"importantDefinitions" (array of strings),
"actionItems" (array of strings),
"possibleQuizQuestions" (array of strings, short question stems only).`

export async function summarizeTranscript(transcript: string): Promise<NotetakerKeyPoints> {
  if (!openai) throw new Error("OpenAI is not configured for summarization.")
  const clipped =
    transcript.length > 48_000
      ? `${transcript.slice(0, 48_000)}\n\n[Transcript truncated for processing.]`
      : transcript

  const { content } = await createWithFallback(openai, {
    model: process.env.OPENAI_DEFAULT_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You extract study materials from a classroom lecture transcript. " +
          SUMMARY_SCHEMA_HINT +
          " No markdown fences. Only valid JSON.",
      },
      {
        role: "user",
        content: `Lecture transcript:\n\n${clipped}`,
      },
    ],
    temperature: 0.4,
    max_tokens: 2_500,
    response_format: { type: "json_object" },
  })

  let parsed: Partial<NotetakerKeyPoints> = {}
  try {
    parsed = JSON.parse(content || "{}")
  } catch {
    throw new Error("Summary model returned non-JSON.")
  }

  return {
    shortSummary: String(parsed.shortSummary || "").trim() || "Summary unavailable.",
    keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts.map(String) : [],
    importantDefinitions: Array.isArray(parsed.importantDefinitions)
      ? parsed.importantDefinitions.map(String)
      : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(String) : [],
    possibleQuizQuestions: Array.isArray(parsed.possibleQuizQuestions)
      ? parsed.possibleQuizQuestions.map(String)
      : [],
  }
}

export function keyPointsToSummaryText(kp: NotetakerKeyPoints): string {
  const lines: string[] = [kp.shortSummary, "", "## Key concepts", ...kp.keyConcepts.map((c) => `- ${c}`)]
  lines.push("", "## Important definitions", ...kp.importantDefinitions.map((c) => `- ${c}`))
  lines.push("", "## Action items / review", ...kp.actionItems.map((c) => `- ${c}`))
  lines.push("", "## Possible quiz questions", ...kp.possibleQuizQuestions.map((c) => `- ${c}`))
  return lines.join("\n")
}
