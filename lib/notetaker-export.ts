import type { NotetakerKeyPoints } from "@/lib/ai-notetaker-process"

export type NotetakerExportSource = {
  title?: string | null
  course_name?: string | null
  lecture_date?: string | null
  summary?: string | null
  transcript?: string | null
  key_points?: NotetakerKeyPoints | unknown | null
}

function bulletSection(title: string, items: string[]): string[] {
  if (!items.length) return []
  return ["", `## ${title}`, ...items.map((item) => `- ${item}`)]
}

function asKeyPoints(raw: unknown): NotetakerKeyPoints | null {
  if (raw == null) return null
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as NotetakerKeyPoints
    } catch {
      return null
    }
  }
  if (typeof raw === "object") return raw as NotetakerKeyPoints
  return null
}

/** Markdown body for Move to My Notes / share / export — mirrors mobile `formatNotetakerNoteBody`. */
export function formatNotetakerNoteBody(note: NotetakerExportSource): string {
  const lines: string[] = []
  if (note.course_name) lines.push(`**Course:** ${note.course_name}`)
  if (note.lecture_date) lines.push(`**Date:** ${note.lecture_date}`)
  if (lines.length) lines.push("")

  if (note.summary?.trim()) {
    lines.push(note.summary.trim())
  } else {
    const kp = asKeyPoints(note.key_points)
    if (kp) {
      if (kp.shortSummary) lines.push(kp.shortSummary)
      lines.push(...bulletSection("Key concepts", kp.keyConcepts ?? []))
      lines.push(...bulletSection("Important definitions", kp.importantDefinitions ?? []))
      lines.push(...bulletSection("Action items / review", kp.actionItems ?? []))
      lines.push(...bulletSection("Possible quiz questions", kp.possibleQuizQuestions ?? []))
    }
  }

  if (note.transcript?.trim()) {
    lines.push("", "## Transcript", note.transcript.trim())
  }

  return lines.join("\n").trim() || "Note (no content yet)."
}

export function formatNotetakerShareText(title: string, note: NotetakerExportSource): string {
  const heading = title.trim() || "Lecture note"
  return `${heading}\n\n${formatNotetakerNoteBody(note)}`
}

export function defaultNoteTitle(): string {
  const d = new Date()
  return `Note — ${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
}
