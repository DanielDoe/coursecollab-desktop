import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorQuestionBankAi } from "@/lib/instructor-question-bank-scope"
import { getCustomQuestionTypeForCourse } from "@/lib/custom-question-types-server"
import { resolveQuestionBankTypeMeta } from "@/lib/custom-question-types"
import { getQuestionBankTypeMeta } from "@/lib/question-bank-type-config"
import {
  generateQuestionDraftFromDescription,
  validateDescribeRequest,
  type QuestionBankDescribeRequest,
} from "@/lib/question-bank-ai-describe-draft"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"

export const dynamic = "force-dynamic"

const DIFFICULTIES = new Set(["easy", "medium", "hard"])

function parseBody(body: Record<string, unknown>): QuestionBankDescribeRequest | null {
  const questionType = String(body.questionType ?? "").trim().toLowerCase()
  if (!getQuestionBankTypeMeta(questionType) && !questionType.startsWith("custom_")) return null

  const difficulty = String(body.difficulty ?? "medium").trim().toLowerCase() as QuestionBankAiDifficulty
  if (!DIFFICULTIES.has(difficulty)) return null

  return {
    questionType,
    description: String(body.description ?? ""),
    correctAnswer: String(body.correctAnswer ?? ""),
    topic: String(body.topic ?? ""),
    difficulty,
    includeHint: body.includeHint !== false,
    includeExplanation: body.includeExplanation !== false,
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankAi(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const req = parseBody(body)
    if (!req) {
      return NextResponse.json({ error: "Invalid generation parameters" }, { status: 400 })
    }

    const customRow =
      req.questionType.startsWith("custom_")
        ? await getCustomQuestionTypeForCourse(scope.course.id, req.questionType)
        : null
    if (req.questionType.startsWith("custom_") && !customRow) {
      return NextResponse.json({ error: "Unknown custom question type" }, { status: 400 })
    }

    const customTypes = customRow ? [customRow] : []
    if (!resolveQuestionBankTypeMeta(req.questionType, customTypes)) {
      return NextResponse.json({ error: "Unsupported question type" }, { status: 400 })
    }

    const validationError = validateDescribeRequest(req, customTypes)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const draft = await generateQuestionDraftFromDescription(req, customTypes)
    return NextResponse.json({ draft })
  } catch (error) {
    console.error("[question-bank generate-draft]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate question" },
      { status: 500 },
    )
  }
}
