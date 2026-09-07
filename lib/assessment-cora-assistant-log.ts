import { sql } from "@/lib/db"
import { recordUsageEvent } from "@/lib/cora/ai/ledger"
import { calculateProviderCostUsd } from "@/lib/cora/ai/pricing"
import type { CoraAiFeature, RawModelUsage } from "@/lib/cora/ai/types"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { logCoraExternalAiCall } from "@/lib/cora/privacy/ai-data-minimization"

export type AssessmentCoraAssistantSource = "quiz" | "practice"

function featureForQuestionType(questionType?: string | null): CoraAiFeature {
  const t = String(questionType ?? "").toLowerCase()
  if (t === "code_write" || t === "code_write_plot") return "CODE_HELP"
  if (t === "multi_part" || t === "circuit_submission") return "STEP_BY_STEP"
  return "CHAT"
}

async function resolveCourseIdForPracticeAttempt(attemptId?: number | null): Promise<number | null> {
  if (attemptId == null || !Number.isFinite(attemptId)) return null
  const rows = (await sql`
    SELECT s.course_id
    FROM practice_attempts pa
    JOIN students s ON s.id = pa.student_id
    WHERE pa.id = ${attemptId}
    LIMIT 1
  `) as Array<{ course_id?: number | null }>
  const courseId = rows[0]?.course_id
  return courseId != null ? Number(courseId) : null
}

async function resolveCourseIdForQuizQuestion(questionId: number): Promise<number | null> {
  const rows = (await sql`
    SELECT q.course_id
    FROM quiz_questions qq
    JOIN quizzes q ON q.id = qq.quiz_id
    WHERE qq.id = ${questionId}
    LIMIT 1
  `) as Array<{ course_id?: number | null }>
  const courseId = rows[0]?.course_id
  return courseId != null ? Number(courseId) : null
}

/** Persist Practice Hub / in-quiz Ask Cora turns for Cora analytics + instructor AI monitoring. */
export async function recordAssessmentCoraAssistantInteraction(args: {
  studentDatabaseId: number
  source: AssessmentCoraAssistantSource
  questionId: number
  questionBankId?: number | null
  questionType?: string | null
  topic?: string | null
  courseId?: number | null
  attemptId?: number | null
  userMessage: string
  assistantMessage: string
  model: string
  usage: RawModelUsage
  creditsCharged: number
  latencyMs?: number
}): Promise<void> {
  try {
    const tier = await getEffectiveMembershipTier(args.studentDatabaseId)
    const feature = featureForQuestionType(args.questionType)
    const module = args.source === "practice" ? "practice_hub_assistant" : "quiz_assistant"
    const operation =
      args.source === "practice" ? "practice_ask_cora" : "quiz_in_exam_ask_cora"

    let courseId = args.courseId ?? null
    if (courseId == null) {
      courseId =
        args.source === "practice"
          ? await resolveCourseIdForPracticeAttempt(args.attemptId)
          : await resolveCourseIdForQuizQuestion(args.questionId)
    }

    logCoraExternalAiCall({
      feature,
      model: args.model,
      messageCount: 2,
      promptChars: args.userMessage.length,
    })

    const providerCostUsd = calculateProviderCostUsd({
      provider: "OPENAI",
      model: args.model,
      usage: args.usage,
    })

    const conversationId =
      args.source === "practice" && args.attemptId
        ? `practice-${args.attemptId}-q-${args.questionBankId ?? args.questionId}`
        : `quiz-q-${args.questionId}`

    await recordUsageEvent({
      context: {
        actor: {
          userId: args.studentDatabaseId,
          userRole: "student",
          membershipTier: tier,
          courseId,
        },
        feature,
        module,
        operation,
        conversationId,
        billable: args.creditsCharged > 0,
      },
      provider: "OPENAI",
      model: args.model,
      usage: args.usage,
      providerCostUsd,
      creditsCharged: args.creditsCharged,
      latencyMs: args.latencyMs,
    })

    const topicLabel = args.topic?.trim() || args.questionType || module
    const bankSuffix =
      args.questionBankId != null ? ` · bank#${args.questionBankId}` : ""

    await sql`
      INSERT INTO ai_tutor_conversations (
        student_id,
        message,
        response,
        topic,
        response_time,
        created_at
      )
      VALUES (
        ${args.studentDatabaseId},
        ${args.userMessage.slice(0, 8000)},
        ${args.assistantMessage.slice(0, 16000)},
        ${`${args.source}:${topicLabel}${bankSuffix}`},
        ${args.latencyMs ?? null},
        NOW()
      )
    `
  } catch (err) {
    console.warn("[Assessment Cora Assistant] analytics log failed", err)
  }
}
