import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { generateQuestionDraftsFromPrompt } from "@/lib/cora/faculty-cora-generate-questions"
import type { QuestionBankAiDifficulty } from "@/lib/question-bank-ai-generation-spec"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      prompt?: string
      count?: number
      topic?: string
      questionType?: string
      difficulty?: QuestionBankAiDifficulty
    }

    const prompt = String(body.prompt ?? "").trim()
    if (!prompt || prompt.length > 4000) {
      return NextResponse.json({ error: "Prompt required (max 4000 chars)" }, { status: 400 })
    }

    const result = await generateQuestionDraftsFromPrompt({
      prompt,
      count: body.count,
      defaultTopic: body.topic,
      questionType: body.questionType,
      difficulty: body.difficulty,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[instructor/cora/tools/generate-questions]", error)
    return NextResponse.json({ error: "Question generation failed" }, { status: 500 })
  }
}
