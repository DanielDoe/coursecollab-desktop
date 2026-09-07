import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { getStudentContextForCora } from "@/lib/cora/fetch-student-context"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import {
  buildStudyNotesScanContext,
  fallbackStudyNotesPack,
  formatStudyNotesPackMarkdown,
  type StudyNotesPack,
  type StudyNotesSection,
  type StudyNotesSectionPhase,
} from "@/lib/cora/study-notes-workspace"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const PHASES: StudyNotesSectionPhase[] = [
  "overview",
  "core",
  "example",
  "pitfalls",
  "check",
  "recap",
]

function parseSections(raw: unknown): StudyNotesSection[] {
  if (!raw || typeof raw !== "object") return []
  const sections = (raw as { sections?: unknown }).sections
  if (!Array.isArray(sections)) return []
  return sections
    .map((s, index) => {
      if (!s || typeof s !== "object") return null
      const o = s as Record<string, unknown>
      const title = String(o.title ?? `Section ${index + 1}`).trim()
      const body = String(o.body ?? "").trim()
      if (!title || !body) return null
      const phaseRaw = String(o.phase ?? PHASES[Math.min(index, PHASES.length - 1)]).toLowerCase()
      const phase = (PHASES.includes(phaseRaw as StudyNotesSectionPhase)
        ? phaseRaw
        : PHASES[Math.min(index, PHASES.length - 1)]) as StudyNotesSectionPhase
      return {
        id: `sec-${index + 1}`,
        index,
        phase,
        title,
        body,
        checkpoint: o.checkpoint ? String(o.checkpoint) : null,
      } satisfies StudyNotesSection
    })
    .filter(Boolean) as StudyNotesSection[]
}

async function ensureDigitalNotesSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS student_digital_notes (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Untitled note',
      body_text TEXT NOT NULL DEFAULT '',
      ink_workspace JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json().catch(() => ({}))) as {
      action?: "generate" | "export"
      topic?: string
      mode?: string
      pack?: StudyNotesPack
      title?: string
    }

    if (body.action === "export") {
      const pack = body.pack
      if (!pack?.sections?.length) {
        return NextResponse.json({ error: "Nothing to export" }, { status: 400 })
      }
      await ensureDigitalNotesSchema()
      const noteTitle =
        body.title?.trim() ||
        (pack.topic ? `Cora Study Notes · ${pack.topic}` : null) ||
        pack.title ||
        "Cora Study Notes"
      const bodyText = formatStudyNotesPackMarkdown(pack)
      const rows = await sql`
        INSERT INTO student_digital_notes (student_id, title, body_text)
        VALUES (${auth.studentDbId}, ${noteTitle}, ${bodyText})
        RETURNING id, title
      `
      const row = rows[0] as { id: number; title: string }
      return NextResponse.json({
        ok: true,
        noteId: row.id,
        title: row.title,
        href: "/student/dashboard-v2/notes",
      })
    }

    const ctx = await getStudentContextForCora(auth.studentDbId)
    const topicHint = body.topic?.trim() || null
    const scan = buildStudyNotesScanContext(ctx, topicHint)
    const topic = topicHint || scan.topic
    const modeRaw = String(body.mode ?? "detailed").toLowerCase()
    const mode = modeRaw === "outline" || modeRaw === "exam" ? modeRaw : "detailed"
    const modeGuide =
      mode === "outline"
        ? "Keep each section short: headings and tight bullets only."
        : mode === "exam"
          ? "High-yield only: must-know facts, formulas, traps, and exam phrasing."
          : "Detailed study notes: clear explanations, examples, and misconceptions."

    let pack = fallbackStudyNotesPack({
      topic,
      courseLabel: scan.courseLabel,
      sources: scan.sources,
      style: mode,
    })

    if (process.env.OPENAI_API_KEY) {
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        const { content } = await createForFeature(openai, "content_tools", {
          messages: [
            {
              role: "system",
              content: `You create immersive, sectioned study-note walkthroughs for university students.
Return JSON only:
{"title":"string","sections":[{"phase":"overview|core|example|pitfalls|check|recap","title":"string","body":"markdown","checkpoint":"optional question"}]}
Rules:
- 5–7 sections in a playable teaching order
- Body is concise markdown (bullets OK), not a chat reply
- Include one checkpoint on the check section
- Align to the student's CourseCollab context when provided
- Note style: ${mode}. ${modeGuide}`,
            },
            {
              role: "user",
              content: `Build sectioned study notes for: "${topic}"

Student CourseCollab scan:
${scan.contextBlock}

Make it feel like an interactive walkthrough the student can play section by section.`,
            },
          ],
          temperature: 0.35,
          response_format: { type: "json_object" },
          max_completion_tokens: 3500,
        })
        const parsed = JSON.parse(content ?? "{}") as { title?: string; sections?: unknown }
        const sections = parseSections(parsed)
        if (sections.length >= 4) {
          pack = {
            title: String(parsed.title ?? `Study notes · ${topic}`).trim(),
            topic,
            courseLabel: scan.courseLabel,
            sources: scan.sources,
            style: mode,
            sections,
            generatedAt: new Date().toISOString(),
          }
        }
      } catch {
        // keep fallback pack
      }
    }

    return NextResponse.json({ ok: true, pack, scan })
  } catch (error) {
    console.error("[study-notes]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build study notes" },
      { status: 500 },
    )
  }
}
