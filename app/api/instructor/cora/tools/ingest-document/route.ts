import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ingestFacultyCoraDocument,
  type FacultyCoraIngestIntent,
} from "@/lib/cora/faculty-cora-ingest-document"
import type { QuestionBankPdfGenerationRequest } from "@/lib/question-bank-ai-from-pdf-types"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const MAX_BYTES = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 })
    }

    const intent = String(formData.get("intent") ?? "extract_questions").trim() as FacultyCoraIngestIntent
    const prompt = String(formData.get("prompt") ?? "").trim() || undefined

    let spec: Partial<QuestionBankPdfGenerationRequest> | undefined
    const specField = formData.get("spec")
    if (typeof specField === "string" && specField.trim()) {
      try {
        spec = JSON.parse(specField) as Partial<QuestionBankPdfGenerationRequest>
      } catch {
        return NextResponse.json({ error: "Invalid generation spec" }, { status: 400 })
      }
    }

    const result = await ingestFacultyCoraDocument({
      file,
      intent:
        intent === "extract_content" || intent === "analyze_assessment"
          ? intent
          : "extract_questions",
      prompt,
      spec,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[instructor/cora/tools/ingest-document]", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Document ingest failed",
      },
      { status: 500 },
    )
  }
}
