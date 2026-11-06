import { NextRequest, NextResponse } from "next/server"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { extractPdfText } from "@/lib/guest/career/extract-resume-text"
import { resolveModelForFeature } from "@/lib/resolve-feature-ai-model"
import { buildChatCompletionBody } from "@/lib/openai-gpt5-mini"
import { DEFAULT_SECTION_CONFIG, type ProjectResponseField, type ProjectTemplateSection } from "@/lib/projects/project-template-types"
import { slugifySectionKey } from "@/lib/projects/project-template-utils"

export const dynamic = "force-dynamic"

const KINDS = new Set(["short_text", "long_text", "image", "file", "link", "checklist"])

function asFields(raw: unknown, sectionIndex: number): ProjectResponseField[] {
  if (!Array.isArray(raw)) return [{ id: `s${sectionIndex}-body`, label: "Response", kind: "long_text", required: true }]
  const fields: ProjectResponseField[] = []
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return
    const o = item as Record<string, unknown>
    const kind = KINDS.has(String(o.kind)) ? (String(o.kind) as ProjectResponseField["kind"]) : "long_text"
    const label = String(o.label || "Response").slice(0, 160)
    fields.push({
      id: `s${sectionIndex}-f${i}`,
      label,
      kind,
      required: o.required !== false,
      help: typeof o.help === "string" ? o.help.slice(0, 240) : undefined,
    })
  })
  return fields.length ? fields : [{ id: `s${sectionIndex}-body`, label: "Response", kind: "long_text", required: true }]
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a PDF or text brief" }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const text = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
      ? await extractPdfText(buf)
      : buf.toString("utf8")
    const brief = text.replace(/\s+/g, " ").trim().slice(0, 24000)
    if (brief.length < 80) {
      return NextResponse.json({ error: "Could not read enough text from that file" }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: "AI is not configured" }, { status: 500 })

    const model = resolveModelForFeature("generation")
    const messages = [
      {
        role: "system" as const,
        content: `You convert a course project brief into a structured report template for students.
Return JSON only:
{"sections":[{"title":"","points":1,"instructions":"","grading_focus":"","fields":[{"label":"","kind":"short_text|long_text|image|file|link|checklist","required":true}]}]}
Use the brief's sections and point values. One student response field per distinct thing they must submit (narrative, diagram, file, link). Keep instructions under 400 characters.`,
      },
      { role: "user" as const, content: brief },
    ]
    const body = buildChatCompletionBody({ model, messages, max_tokens: 2500 })
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) return NextResponse.json({ error: "AI draft failed" }, { status: 502 })
    const data = await res.json()
    const raw = String(data.choices?.[0]?.message?.content || "{}")
      .replace(/```json\s*/g, "")
      .replace(/```/g, "")
      .trim()
    const parsed = JSON.parse(raw) as { sections?: Array<Record<string, unknown>> }
    const sections: ProjectTemplateSection[] = (parsed.sections ?? []).slice(0, 16).map((s, i) => {
      const title = String(s.title || `Section ${i + 1}`)
      return {
        section_key: slugifySectionKey(title, i),
        sort_order: i,
        title,
        instructions: String(s.instructions || ""),
        config: {
          ...DEFAULT_SECTION_CONFIG(),
          points: Math.max(0, Number(s.points) || 0),
          expected_content: String(s.grading_focus || ""),
          response_fields: asFields(s.fields, i + 1),
        },
      }
    })
    if (!sections.length) return NextResponse.json({ error: "No sections were drafted" }, { status: 422 })
    return NextResponse.json({ sections })
  } catch (error) {
    console.error("[draft-template]", error)
    return NextResponse.json({ error: "Failed to draft template" }, { status: 500 })
  }
}
