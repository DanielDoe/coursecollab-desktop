import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorQuestionBankAi } from "@/lib/instructor-question-bank-scope"
import { generateQuestionsFromPdfBuffer } from "@/lib/question-bank-ai-from-pdf"
import {
  defaultPdfGenerationRequest,
  validatePdfGenerationRequest,
  type QuestionBankPdfGenerationRequest,
} from "@/lib/question-bank-ai-from-pdf-types"
import { getQuestionBankTypeMeta, type QuestionBankTypeId } from "@/lib/question-bank-type-config"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const MAX_PDF_BYTES = 25 * 1024 * 1024

function parseRequest(formData: FormData): { pdf: File; spec: QuestionBankPdfGenerationRequest } | null {
  const file = formData.get("file")
  if (!(file instanceof File) || file.size <= 0) return null
  if (file.size > MAX_PDF_BYTES) return null

  const mime = (file.type || "").toLowerCase()
  const name = file.name.toLowerCase()
  if (mime !== "application/pdf" && !name.endsWith(".pdf")) return null

  let rawSpec: Record<string, unknown> = {}
  const specField = formData.get("spec")
  if (typeof specField === "string" && specField.trim()) {
    try {
      rawSpec = JSON.parse(specField) as Record<string, unknown>
    } catch {
      return null
    }
  }

  const questionType = String(rawSpec.questionType ?? "mcq").trim().toLowerCase() as QuestionBankTypeId
  if (!getQuestionBankTypeMeta(questionType)) return null

  const base = defaultPdfGenerationRequest(questionType)
  const spec: QuestionBankPdfGenerationRequest = {
    ...base,
    questionType,
    topic: String(rawSpec.topic ?? base.topic),
    difficulty: (String(rawSpec.difficulty ?? base.difficulty) as QuestionBankPdfGenerationRequest["difficulty"]),
    questionCount: Math.min(15, Math.max(1, Number(rawSpec.questionCount) || base.questionCount)),
    optionCount: Math.min(8, Math.max(2, Number(rawSpec.optionCount) || base.optionCount)),
    includeHint: rawSpec.includeHint !== false,
    includeExplanation: rawSpec.includeExplanation !== false,
    programmingLanguage: String(rawSpec.programmingLanguage ?? base.programmingLanguage),
    subPartCount: Math.min(10, Math.max(2, Number(rawSpec.subPartCount) || base.subPartCount)),
    maxPdfPages: Math.min(12, Math.max(1, Number(rawSpec.maxPdfPages) || base.maxPdfPages)),
    additionalInstructions: String(rawSpec.additionalInstructions ?? "").slice(0, 2000),
  }

  return { pdf: file, spec }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankAi(request)
    if (!scope.ok) return scope.response

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: "Valid PDF file and generation spec required" }, { status: 400 })
    }
    const parsed = parseRequest(formData)
    if (!parsed) {
      return NextResponse.json({ error: "Valid PDF file and generation spec required" }, { status: 400 })
    }

    const validationError = validatePdfGenerationRequest(parsed.spec)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const bytes = Buffer.from(await parsed.pdf.arrayBuffer())
    const result = await generateQuestionsFromPdfBuffer(bytes, parsed.spec)

    return NextResponse.json({
      questions: result.questions,
      meta: {
        modelUsed: result.modelUsed,
        pageCount: result.pageCount,
        questionType: parsed.spec.questionType,
        topic: parsed.spec.topic,
      },
    })
  } catch (error) {
    console.error("[question-bank generate-from-pdf]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate questions from PDF" },
      { status: 500 },
    )
  }
}
