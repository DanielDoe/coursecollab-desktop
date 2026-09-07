import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorQuestionBankAi } from "@/lib/instructor-question-bank-scope"
import { generateCustomQuestionTypeFromDescription } from "@/lib/custom-question-type-ai"
import { validateCustomQuestionTypeDraft } from "@/lib/custom-question-types"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorQuestionBankAi(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const description = String(body.description ?? "").trim()
    const suggestedName = String(body.suggestedName ?? "").trim()

    if (description.length < 20) {
      return NextResponse.json(
        { error: "Describe the question type in at least a few sentences." },
        { status: 400 },
      )
    }

    const draft = await generateCustomQuestionTypeFromDescription(description, suggestedName || undefined)
    const validationError = validateCustomQuestionTypeDraft(draft)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error("[custom-types generate]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate question type" },
      { status: 500 },
    )
  }
}
