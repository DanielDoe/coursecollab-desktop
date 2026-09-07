import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier, getAITutorCredits, deductAITutorCredits } from "@/lib/membership"
import { chatCompletionWithFallback } from "@/lib/openai-with-fallback"
import {
  QUIZ_CODE_COACH_SYSTEM_PROMPT,
  ECE2202_LEARNING_ASSISTANT_SYSTEM_PROMPT,
  buildCodeCoachContextBlock,
  buildEce2202AssistantContextBlock,
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
export const maxDuration = 60 // Vercel: AI calls need longer than default 10s

/**
 * POST /api/quiz/ai-assistant
 *
 * In-exam coaching. Uses monthly Cora Credits (all tiers with allocation).
 * Core principle: never generate final answers or complete solutions.
 */
const LOG = "[Quiz AI Assistant]"

export async function POST(request: NextRequest) {
  try {
    console.log(`${LOG} POST received`)
    const body = await request.json()
    const { studentId, questionId, questionText, studentCode, studentWork, conversationHistory = [], userRequest } = body
    console.log(`${LOG} Parsed body: studentId=${studentId}, questionId=${questionId}, hasQuestionText=${!!questionText}`)

    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    if (!questionId || !questionText) {
      return NextResponse.json(
        { error: "Question ID and question text are required" },
        { status: 400 }
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
      source: "quiz",
      questionId: Number(questionId),
      questionType: null,
    })
    if (askCoraGate.blockBeforeModel) {
      void logAskCoraGateEvent({
        studentId: studentDatabaseId,
        gate: askCoraGate,
        answerBlocked: true,
      })
      return NextResponse.json({ message: askCoraGate.refusalMessage })
    }
    const effectiveTier = await getEffectiveMembershipTier(studentDatabaseId)
    console.log(`${LOG} Membership tier: ${effectiveTier}`)

    const { estimateCoraCreditsForMessage } = await import("@/lib/cora/credits")
    const userMessageLen =
      typeof userRequest === "string" ? userRequest.length : JSON.stringify(userRequest || "").length
    const estimatedCredits = estimateCoraCreditsForMessage(
      typeof userRequest === "string" ? userRequest : `len:${userMessageLen}`,
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
        { status: 403 }
      )
    }

    // Get question details
    console.log(`${LOG} Fetching question ${questionId}`)
    const questionData = (await sql`
      SELECT 
        question_text,
        question_type,
        hint,
        answer_guidelines,
        topic,
        difficulty,
        subquestions
      FROM quiz_questions
      WHERE id = ${questionId}
      LIMIT 1
    `) as Array<{
      question_text: string | null
      question_type: string | null
      hint: string | null
      answer_guidelines: unknown
      topic: string | null
      difficulty: string | null
      subquestions: unknown
    }>
    console.log(`${LOG} Question found: ${questionData.length > 0}`)

    if (questionData.length === 0) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 }
      )
    }

    const qt = String(questionData[0].question_type || "").toLowerCase()
    const isCodeQuestion = qt === "code_write" || qt === "code_write_plot"
    const isMultiPart = qt === "multi_part"
    const isCircuitSubmission = qt === "circuit_submission"
    if (!canStudentAskCora(qt)) {
      return NextResponse.json(
        { error: "Ask Cora is only available for written work such as code write, code write + plot, multi-part, and circuit submission questions." },
        { status: 403 }
      )
    }

    const question = questionData[0]
    const rawGuidelines = question.answer_guidelines 
      ? (typeof question.answer_guidelines === 'string' 
          ? JSON.parse(question.answer_guidelines) 
          : question.answer_guidelines)
      : []
    const answerGuidelines = guidelinesAllowedForPolicy(rawGuidelines, askCoraGate.policy)

    const subquestionSummary = isMultiPart ? summarizeSubquestionsForAi(question.subquestions) : null

    const systemPrompt =
      (isMultiPart || isCircuitSubmission
        ? `${ECE2202_LEARNING_ASSISTANT_SYSTEM_PROMPT}

${buildEce2202AssistantContextBlock({
  topic: question.topic,
  difficulty: question.difficulty,
  hint: question.hint,
  subquestionSummary: isMultiPart ? subquestionSummary : null,
})}`
        : `${QUIZ_CODE_COACH_SYSTEM_PROMPT}${
            qt === "code_write_plot"
              ? "\n\nQUESTION TYPE: code_write_plot — guide toward correct plotting approach only; never output the final plot image, exact coordinates, or complete plotting code."
              : ""
          }

${buildCodeCoachContextBlock({
  topic: question.topic,
  difficulty: question.difficulty,
  hint: question.hint,
  answerGuidelines,
})}`) + askCoraGate.promptAppendix

    // Build user message - ALWAYS include question and code for context
    // The user's help request comes from the request body (student's input)
    // For the first message, we'll construct it; for follow-ups, it's in conversationHistory
    // We need to get the actual help request from the request body
    // Since we don't have it directly, we'll construct the message to include question and code
    // The actual user input will be appended in the user message
    
    // Build comprehensive user message with question and code ALWAYS included
    // This ensures the AI has full context for every request
    // Get the actual help request from userRequest or from the last message in conversation history
    let actualHelpRequest = userRequest
    if (!actualHelpRequest && conversationHistory.length > 0) {
      // Extract from last user message in conversation history
      const lastUserMsg = conversationHistory.filter((msg: any) => msg.role === "user").pop()
      if (lastUserMsg) {
        // Extract just the help request part (remove question/code context if present)
        actualHelpRequest = lastUserMsg.content
          .replace(/Question:[\s\S]*?What I need help with:\s*/i, "")
          .replace(/My Current Code:[\s\S]*?What I need help with:\s*/i, "")
          .trim()
      }
    }
    
    if (!actualHelpRequest) {
      actualHelpRequest =
        isMultiPart || isCircuitSubmission
          ? studentWork
            ? "Can you review my work so far and guide me on the next step?"
            : "Can you help me understand how to approach this circuit problem?"
          : studentCode
            ? "Can you help me with my code?"
            : "Can you give me guidance on how to approach this?"
    }

    const workBlock =
      isMultiPart || isCircuitSubmission
        ? studentWork
          ? `My Current Work (upload notes — do not give final answers or step-by-step solutions):\n${String(studentWork).slice(0, 4000)}\n\n`
          : "I have not uploaded my solution yet.\n\n"
        : studentCode
          ? `My Current Code:\n\`\`\`cpp\n${studentCode}\n\`\`\`\n\n`
          : "I haven't written code yet.\n\n"

    const userMessage = `Question:\n${questionText}\n\n${workBlock}What I need help with: ${actualHelpRequest}`

    // Prepare messages for OpenAI API
    // For first message, include question and code in context
    // For follow-up messages, include them in the user message for context
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map((msg: { role: string; content: string }) => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: userMessage }
    ]
    
    // If this is a follow-up (has conversation history), ensure question and code context is maintained
    // The user message already includes this, but we can add it as context if needed

    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error(`${LOG} Missing OPENAI_API_KEY`)
      return NextResponse.json(
        { error: "AI service is not configured. Set OPENAI_API_KEY in Vercel environment variables." },
        { status: 500 }
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
      if (result.usedFallback) {
        console.log(`${LOG} Used fallback model ${result.modelUsed}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`${LOG} OpenAI error:`, msg)
      return NextResponse.json(
        { error: msg || "The AI service could not generate a response. Please try again.", code: "OPENAI_ERROR" },
        { status: 500 }
      )
    }

    const gated = applyAskCoraOutputGate(assistantMessage, askCoraGate.policy)
    const finalResponse = gated.text
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
        { status: 403 }
      )
    }

    void recordAssessmentCoraAssistantInteraction({
      studentDatabaseId,
      source: "quiz",
      questionId: Number(questionId),
      questionType: qt,
      topic: question.topic,
      userMessage: String(actualHelpRequest),
      assistantMessage: finalResponse,
      model: modelUsed,
      usage,
      creditsCharged: estimatedCredits,
      latencyMs: Date.now() - startedAt,
    })

    return NextResponse.json({
      message: finalResponse,
      conversationHistory: [
        ...conversationHistory,
        { role: "user", content: userMessage },
        { role: "assistant", content: finalResponse }
      ]
    })

  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    // Use process.stderr to bypass any console override - always visible in Vercel logs
    process.stderr?.write?.(`${LOG} CAUGHT: ${err.message}\n`)
    process.stderr?.write?.(`${LOG} Stack: ${err.stack || "none"}\n`)
    console.error(`${LOG} CAUGHT ERROR:`, err.message, err.stack)
    const code = err.message?.includes("DATABASE") ? "DB_ERROR" : err.message?.includes("OPENAI") || err.message?.includes("fetch") ? "OPENAI_ERROR" : "UNKNOWN_ERROR"
    return NextResponse.json(
      {
        error: "An error occurred while processing your request",
        code,
        detail: err.message,
        stack: process.env.NODE_ENV === "production" ? err.stack : undefined,
      },
      { status: 500 }
    )
  }
}
