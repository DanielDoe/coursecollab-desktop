import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 60

interface Question {
  question: string
  type: "multiple_choice" | "short_answer"
  options?: string[]
  correctAnswer: string
  explanation: string
}

export async function POST(request: NextRequest) {
  try {
    const { code, language = "cpp", studentId, learningMode = "intermediate" } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      )
    }

    if (!isOpenAIConfigured || !openai) {
      return NextResponse.json(
        { error: "AI evaluation is not configured" },
        { status: 500 }
      )
    }

    // Generate 3-5 comprehension questions based on the code and learning mode
    const difficultyGuidance = learningMode === "beginner"
      ? `For BEGINNER level students:
- Ask simple, direct questions about basic concepts
- Focus on understanding what the code does (not how it works in detail)
- Use simple language and avoid technical jargon
- Test basic understanding: "What does this line do?", "What is the output?"
- Questions should be straightforward and build confidence`
      : learningMode === "expert"
      ? `For EXPERT level students:
- Ask advanced questions about optimization, edge cases, and design patterns
- Test deep understanding: "How would you optimize this?", "What edge cases aren't handled?"
- Focus on engineering principles, performance implications, and best practices
- Challenge with complex scenarios and alternative approaches`
      : `For INTERMEDIATE level students:
- Ask questions that test algorithmic understanding and logic flow
- Test ability to trace execution and predict outcomes
- Focus on concepts like loops, conditionals, data structures
- Balance between basic understanding and deeper analysis`

    const { content: questionsContent } = await createForFeature(openai, "codebench", {

      messages: [
        {
          role: "system",
          content: `You are an expert programming educator. Generate 3-5 comprehension questions to test if a student understands their code.

${difficultyGuidance}

Generate questions that test:
1. Understanding of code logic and flow
2. Knowledge of concepts used
3. Ability to predict output
4. Understanding of data structures/algorithms used

Format your response as JSON:
{
  "questions": [
    {
      "question": "What does this code do?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "Brief explanation"
    },
    {
      "question": "What will be the output if input is X?",
      "type": "short_answer",
      "correctAnswer": "Expected output",
      "explanation": "Brief explanation"
    }
  ]
}

Mix multiple choice and short answer questions. Ensure questions are directly related to the student's code and match their ${learningMode} level.`,
        },
        {
          role: "user",
          content: `Generate comprehension questions for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    })

    let questionsData
    try {
      questionsData = JSON.parse(questionsContent || "{}")
    } catch (parseError) {
      console.error("[CodeBench Evaluate] JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse evaluation questions" },
        { status: 500 }
      )
    }

    const questions: Question[] = questionsData.questions || []

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No questions generated" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      questions: questions.map((q) => ({
        question: q.question,
        type: q.type,
        options: q.options,
      })),
      success: true,
    })
  } catch (error) {
    console.error("[CodeBench Evaluate] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to evaluate code" },
      { status: 500 }
    )
  }
}

