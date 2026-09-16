import { sql } from "@/lib/db"
import {
  classifyAssistanceLevel,
  classifyInteractionCategory,
  classifyConcept,
} from "@/lib/cora/insights/classify"
import { ensureCoraInsightsSchema } from "@/lib/cora/insights/schema"
import type { AssistanceLevel, CoraInteractionCategory } from "@/lib/cora/insights/taxonomy"

export type RecordCoraInteractionInput = {
  userId: number
  courseId?: number | null
  sectionId?: number | null
  conversationId?: string | null
  assessmentId?: number | null
  questionId?: number | null
  questionType?: string | null
  occurredAt?: Date | string | null
  interactionCategory?: CoraInteractionCategory | string | null
  concept?: string | null
  subconcept?: string | null
  assistanceLevel?: AssistanceLevel | number | null
  intent?: string | null
  answerSeekingDetected?: boolean
  answerBlocked?: boolean
  assessmentProtected?: boolean
  attemptBefore?: number | null
  attemptAfter?: number | null
  correctAfter?: boolean | null
  independentFollowup?: boolean | null
  independentCorrect?: boolean | null
  latencyMs?: number | null
  tokensIn?: number | null
  tokensOut?: number | null
  creditsUsed?: number | null
  source: string
  sourceRef?: string | null
  text?: string | null
  topic?: string | null
  module?: string | null
  feature?: string | null
  assistanceCategory?: string | null
  metadata?: Record<string, unknown> | null
}

/** Best-effort structured event write. Never throws to callers. */
export async function recordCoraInteractionEvent(input: RecordCoraInteractionInput): Promise<number | null> {
  if (!Number.isFinite(input.userId) || input.userId <= 0) return null
  try {
    await ensureCoraInsightsSchema()
    const category =
      input.interactionCategory ??
      classifyInteractionCategory({
        text: input.text,
        topic: input.topic,
        module: input.module,
        feature: input.feature,
        assistanceCategory: input.assistanceCategory,
        answerSeeking: input.answerSeekingDetected,
        questionType: input.questionType,
      })
    const concept = input.concept ?? classifyConcept(input.text, input.topic)
    const level =
      input.assistanceLevel ??
      classifyAssistanceLevel({
        hintLevel: input.assistanceLevel,
        assistanceCategory: input.assistanceCategory,
        answerSeeking: input.answerSeekingDetected,
      })
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()

    const rows = (await sql`
      INSERT INTO cora_interaction_events (
        user_id, course_id, section_id, conversation_id, assessment_id, question_id, question_type,
        occurred_at, interaction_category, concept, subconcept, assistance_level, intent,
        answer_seeking_detected, answer_blocked, assessment_protected,
        attempt_before, attempt_after, correct_after, independent_followup, independent_correct,
        latency_ms, tokens_in, tokens_out, credits_used, source, source_ref, metadata
      ) VALUES (
        ${input.userId},
        ${input.courseId ?? null},
        ${input.sectionId ?? null},
        ${input.conversationId ?? null},
        ${input.assessmentId ?? null},
        ${input.questionId ?? null},
        ${input.questionType ?? null},
        ${occurredAt.toISOString()},
        ${String(category)},
        ${concept},
        ${input.subconcept ?? null},
        ${Number(level)},
        ${input.intent ?? null},
        ${Boolean(input.answerSeekingDetected)},
        ${Boolean(input.answerBlocked)},
        ${Boolean(input.assessmentProtected)},
        ${input.attemptBefore ?? null},
        ${input.attemptAfter ?? null},
        ${input.correctAfter ?? null},
        ${input.independentFollowup ?? null},
        ${input.independentCorrect ?? null},
        ${input.latencyMs ?? null},
        ${input.tokensIn ?? null},
        ${input.tokensOut ?? null},
        ${input.creditsUsed ?? null},
        ${input.source},
        ${input.sourceRef ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb
      )
      RETURNING id
    `) as Array<{ id: number }>

    const id = rows[0]?.id ?? null
    if (id != null && input.courseId) {
      await incrementDailyRollup({
        courseId: input.courseId,
        studentId: input.userId,
        day: occurredAt,
        concept: concept ?? "",
        category: String(category),
        assistanceLevel: Number(level) || 0,
        answerSeeking: Boolean(input.answerSeekingDetected),
        answerBlocked: Boolean(input.answerBlocked),
        correctAfter: input.correctAfter,
        independentFollowup: input.independentFollowup,
        independentCorrect: input.independentCorrect,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        creditsUsed: input.creditsUsed ?? 0,
      }).catch(() => undefined)
    }
    return id
  } catch (err) {
    console.warn("[cora-insights] record failed", err)
    return null
  }
}

async function incrementDailyRollup(input: {
  courseId: number
  studentId: number
  day: Date
  concept: string
  category: string
  assistanceLevel: number
  answerSeeking: boolean
  answerBlocked: boolean
  correctAfter?: boolean | null
  independentFollowup?: boolean | null
  independentCorrect?: boolean | null
  tokensIn: number
  tokensOut: number
  creditsUsed: number
}) {
  const day = input.day.toISOString().slice(0, 10)
  await sql`
    INSERT INTO cora_insights_daily (
      course_id, day, student_id, concept, category, assistance_level,
      interactions, answer_seeking, answers_blocked, known_after, correct_after,
      independent_known, independent_correct, tokens_in, tokens_out, credits_used
    ) VALUES (
      ${input.courseId},
      ${day}::date,
      ${input.studentId},
      ${input.concept},
      ${input.category},
      ${input.assistanceLevel},
      1,
      ${input.answerSeeking ? 1 : 0},
      ${input.answerBlocked ? 1 : 0},
      ${input.correctAfter == null ? 0 : 1},
      ${input.correctAfter === true ? 1 : 0},
      ${input.independentFollowup ? 1 : 0},
      ${input.independentCorrect === true ? 1 : 0},
      ${input.tokensIn},
      ${input.tokensOut},
      ${input.creditsUsed}
    )
    ON CONFLICT (course_id, day, student_id, concept, category, assistance_level)
    DO UPDATE SET
      interactions = cora_insights_daily.interactions + 1,
      answer_seeking = cora_insights_daily.answer_seeking + EXCLUDED.answer_seeking,
      answers_blocked = cora_insights_daily.answers_blocked + EXCLUDED.answers_blocked,
      known_after = cora_insights_daily.known_after + EXCLUDED.known_after,
      correct_after = cora_insights_daily.correct_after + EXCLUDED.correct_after,
      independent_known = cora_insights_daily.independent_known + EXCLUDED.independent_known,
      independent_correct = cora_insights_daily.independent_correct + EXCLUDED.independent_correct,
      tokens_in = cora_insights_daily.tokens_in + EXCLUDED.tokens_in,
      tokens_out = cora_insights_daily.tokens_out + EXCLUDED.tokens_out,
      credits_used = cora_insights_daily.credits_used + EXCLUDED.credits_used
  `
}
