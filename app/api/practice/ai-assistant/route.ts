import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { deductAITutorCredits, getAITutorCredits } from "@/lib/membership"
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import {
  PRACTICE_HUB_COACH_SYSTEM_PROMPT,
  QUIZ_CODE_COACH_SYSTEM_PROMPT,
  buildCodeCoachContextBlock,
  buildEce2202AssistantContextBlock,
  buildPracticeCoachContextBlock,
} from "@/lib/quiz-ai-assistant-prompts"
import { summarizeSubquestionsForAi } from "@/lib/quiz-ai-assistant-multipart"
import { canStudentAskCora } from "@/lib/cora/ask-cora-eligibility"
import {
  applyAskCoraOutputGate,
  enforceAskCoraGate,
  guidelinesAllowedForPolicy,
  logAskCoraGateEvent,
} from "@/lib/cora/assessment-policy-gate"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { recordAssessmentCoraAssistantInteraction } from "@/lib/assessment-cora-assistant-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

const LOG = "[Practice AI Assistant]"

function isCodeQuestionType(qType: string): boolean {
  return qType === "code_write" || qType === "code_write_plot"
}

function isMultiPartOrCircuit(qType: string): boolean {
  return qType === "multi_part" || qType === "circuit_submission"
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      studentId,
      questionBankId,
      questionText,
      questionType,
      studentCode,
      studentWork,
      conversationHistory = [],
      userRequest,
      attemptId,
    } = body

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    if (!questionBankId || !questionText) {
      return NextResponse.json(
        { error: "Question ID and question text are required" },
        { status: 400 },
      )
    }

    const studentDatabaseId = auth.studentDbId
    if (studentId && parseInt(String(studentId), 10) !== studentDatabaseId) {
      return NextResponse.json({ error: "Student ID mismatch" }, { status: 403 })
    }

    const helpRequest = String(userRequest ?? "").trim()
    const askCoraGate = await enforceAskCoraGate({
      studentId: studentDatabaseId,
      message: helpRequest,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      source: "practice_hub",
      bankQuestionId: Number(questionBankId),
      questionId: Number(questionBankId),
      attemptId: attemptId != null ? Number(attemptId) : null,
      questionType: questionType != null ? String(questionType) : null,
    })
    if (askCoraGate.blockBeforeModel) {
      void logAskCoraGateEvent({
        studentId: studentDatabaseId,
        gate: askCoraGate,
        answerBlocked: true,
      })
      return NextResponse.json({ message: askCoraGate.refusalMessage })
    }

    const { estimateCoraCreditsForMessage } = await import("@/lib/cora/credits")
    const estimatedCredits = estimateCoraCreditsForMessage(
      typeof userRequest === "string" ? userRequest : `len:${String(userRequest ?? "").length}`,
    )

    const currentCredits = await getAITutorCredits(studentDatabaseId)
    if (currentCredits < estimatedCredits) {
      return NextResponse.json(
        {
          error: `Not enough Cora Credits (${currentCredits} left; ~${estimatedCredits} needed). Credits refresh monthly.`,
          requiresUpgrade: true,
          creditsInsufficient: true,
          creditsRemaining: currentCredits,
          creditsNeeded: estimatedCredits,
        },
        { status: 403 },
      )
    }

    const rows = (await sql`
      SELECT
        question_text,
        question_type,
        hint,
        topic,
        difficulty,
        answer_guidelines,
        subquestions
      FROM question_bank
      WHERE id = ${questionBankId}
        AND deleted_at IS NULL
      LIMIT 1
    `) as Array<{
      question_text: string | null
      question_type: string | null
      hint: string | null
      topic: string | null
      difficulty: string | null
      answer_guidelines: unknown
      subquestions: unknown
    }>

    if (rows.length === 0) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 })
    }

    const question = rows[0]
    const qt = String(questionType || question.question_type || "mcq").toLowerCase()
    if (!canStudentAskCora(qt)) {
      return NextResponse.json(
        { error: "Ask Cora is only available for written work such as code write and circuit submissions." },
        { status: 403 },
      )
    }
    const rawGuidelines = question.answer_guidelines
      ? typeof question.answer_guidelines === "string"
        ? JSON.parse(question.answer_guidelines)
        : question.answer_guidelines
      : []
    const answerGuidelines = guidelinesAllowedForPolicy(rawGuidelines, askCoraGate.policy)

    const subquestionSummary = qt === "multi_part" ? summarizeSubquestionsForAi(question.subquestions) : null

    let systemPrompt = `${PRACTICE_HUB_COACH_SYSTEM_PROMPT}

${buildPracticeCoachContextBlock({
  topic: question.topic,
  difficulty: question.difficulty,
  hint: question.hint,
  questionType: qt,
})}`

    if (isCodeQuestionType(qt)) {
      systemPrompt = `${QUIZ_CODE_COACH_SYSTEM_PROMPT}

${buildCodeCoachContextBlock({
  topic: question.topic,
  difficulty: question.difficulty,
  hint: question.hint,
  answerGuidelines: Array.isArray(answerGuidelines) ? answerGuidelines : [],
})}`
    } else if (isMultiPartOrCircuit(qt)) {
      systemPrompt = `${buildEce2202AssistantContextBlock({
        topic: question.topic,
        difficulty: question.difficulty,
        hint: question.hint,
        subquestionSummary,
      })}

${buildPracticeCoachContextBlock({
  topic: question.topic,
  difficulty: question.difficulty,
  hint: question.hint,
  questionType: qt,
})}`
    }
    systemPrompt += askCoraGate.promptAppendix

    let actualHelpRequest = userRequest
    if (!actualHelpRequest && conversationHistory.length > 0) {
      const lastUserMsg = conversationHistory.filter((msg: { role: string }) => msg.role === "user").pop()
      if (lastUserMsg) {
        actualHelpRequest = String(lastUserMsg.content)
          .replace(/Question:[\s\S]*?What I need help with:\s*/i, "")
          .replace(/My Current Code:[\s\S]*?What I need help with:\s*/i, "")
          .trim()
      }
    }

    if (!actualHelpRequest) {
      actualHelpRequest = isCodeQuestionType(qt)
        ? studentCode
          ? "Can you help me with my code?"
          : "How should I approach this coding problem?"
        : studentWork
          ? "Can you review my approach and give me a hint?"
          : "Can you help me understand how to approach this question?"
    }

    const workBlock = isCodeQuestionType(qt)
      ? studentCode
        ? `My Current Code:\n\`\`\`cpp\n${studentCode}\n\`\`\`\n\n`
        : "I haven't written code yet.\n\n"
      : isMultiPartOrCircuit(qt)
        ? studentWork
          ? `My Current Work:\n${String(studentWork).slice(0, 4000)}\n\n`
          : "I have not submitted my work yet.\n\n"
        : studentWork
          ? `My current answer/selection: ${String(studentWork).slice(0, 500)}\n\n`
          : "I haven't selected an answer yet.\n\n"

    const userMessage = `Question:\n${questionText}\n\n${workBlock}What I need help with: ${actualHelpRequest}`

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: userMessage },
    ]

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "AI service is not configured. Set OPENAI_API_KEY in Vercel environment variables." },
        { status: 500 },
      )
    }

    const primaryModel = process.env.OPENAI_QUIZ_ASSISTANT_MODEL || "gpt-5-mini"
    const startedAt = Date.now()
    let assistantMessage: string
    let modelUsed = primaryModel
    let usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
    try {
      const result = await chatCompletionWithFallback(openaiApiKey, {
        model: primaryModel,
        messages: messages as { role: string; content: string }[],
        max_tokens: 300,
        temperature: 0.7,
      })
      assistantMessage = result.content
      modelUsed = result.modelUsed
      usage = result.usage
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`${LOG} OpenAI error:`, msg)
      return NextResponse.json(
        { error: msg || "The AI service could not generate a response. Please try again.", code: "OPENAI_ERROR" },
        { status: 500 },
      )
    }

    const gated = applyAskCoraOutputGate(assistantMessage, askCoraGate.policy)
    assistantMessage = gated.text
    void logAskCoraGateEvent({
      studentId: studentDatabaseId,
      gate: askCoraGate,
      answerBlocked: gated.blockedAnswer,
      providedConceptualGuidance: !gated.blockedAnswer,
    })

    const deducted = await deductAITutorCredits(studentDatabaseId, estimatedCredits)
    if (!deducted) {
      return NextResponse.json(
        {
          error: "Could not use Cora Credits for this message. Check your balance and try again.",
          requiresUpgrade: true,
        },
        { status: 403 },
      )
    }

    void recordAssessmentCoraAssistantInteraction({
      studentDatabaseId,
      source: "practice",
      questionId: Number(questionBankId),
      questionBankId: Number(questionBankId),
      questionType: qt,
      topic: question.topic,
      attemptId: attemptId != null ? Number(attemptId) : null,
      userMessage: String(actualHelpRequest),
      assistantMessage,
      model: modelUsed,
      usage,
      creditsCharged: estimatedCredits,
      latencyMs: Date.now() - startedAt,
    })

    return NextResponse.json({ message: assistantMessage })
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error(`${LOG} CAUGHT ERROR:`, err.message, err.stack)
    return NextResponse.json(
      {
        error: "An error occurred while processing your request",
        detail: err.message,
      },
      { status: 500 },
    )
  }
}
