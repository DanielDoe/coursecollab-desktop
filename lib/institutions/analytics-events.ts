import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"

export const ANALYTICS_EVENT_TYPES = [
  "practice_started",
  "practice_attempted",
  "practice_correct",
  "practice_incorrect",
  "hint_requested",
  "cora_opened",
  "cora_message_sent",
  "cora_response_received",
  "cora_tool_called",
  "cora_session_completed",
  "assessment_started",
  "assessment_submitted",
  "feedback_generated",
  "feedback_viewed",
  "assignment_opened",
  "assignment_submitted",
  "flashcard_reviewed",
  "intervention_triggered",
  "intervention_delivered",
  "intervention_viewed",
  "intervention_engaged",
  "intervention_completed",
  "concept_mastery_updated",
] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

export type RecordAnalyticsEventInput = {
  institutionId: number
  userId?: number | null
  userType?: string | null
  courseId?: number | null
  sectionId?: number | null
  sessionId?: string | null
  eventType: AnalyticsEventType | string
  feature?: string | null
  workflow?: string | null
  conceptId?: string | null
  assessmentId?: number | null
  questionId?: number | null
  occurredAt?: Date | string | null
  durationMs?: number | null
  metadata?: Record<string, unknown>
  researchContext?: Record<string, unknown>
}

/** Best-effort standardized event write. Failures must not break product flows. */
export async function recordAnalyticsEvent(input: RecordAnalyticsEventInput): Promise<void> {
  if (!Number.isFinite(input.institutionId) || input.institutionId <= 0) return
  try {
    await ensureInstitutionSchema()
    const occurredAt =
      input.occurredAt instanceof Date
        ? input.occurredAt.toISOString()
        : input.occurredAt ?? new Date().toISOString()
    await sql`
      INSERT INTO analytics_events (
        institution_id, user_id, user_type, course_id, section_id, session_id,
        event_type, feature, workflow, concept_id, assessment_id, question_id,
        occurred_at, duration_ms, metadata_json, research_context_json
      ) VALUES (
        ${input.institutionId},
        ${input.userId ?? null},
        ${input.userType ?? null},
        ${input.courseId ?? null},
        ${input.sectionId ?? null},
        ${input.sessionId ?? null},
        ${String(input.eventType).slice(0, 64)},
        ${input.feature ?? null},
        ${input.workflow ?? null},
        ${input.conceptId ?? null},
        ${input.assessmentId ?? null},
        ${input.questionId ?? null},
        ${occurredAt},
        ${input.durationMs ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${JSON.stringify(input.researchContext ?? {})}::jsonb
      )
    `
  } catch (err) {
    console.warn("[analytics-events] record failed", err)
  }
}

export async function recordCoraAnalyticsEvents(input: {
  institutionId: number
  userId: number
  userType: "student" | "instructor"
  courseId?: number | null
  workflowType?: string | null
  sessionId?: string | null
  credits?: number
  model?: string | null
  toolCalls?: number
  latencyMs?: number | null
}): Promise<void> {
  await recordAnalyticsEvent({
    institutionId: input.institutionId,
    userId: input.userId,
    userType: input.userType,
    courseId: input.courseId ?? null,
    sessionId: input.sessionId ?? null,
    eventType: "cora_session_completed",
    feature: "cora",
    workflow: input.workflowType ?? "cora",
    durationMs: input.latencyMs ?? null,
    metadata: {
      credits: input.credits ?? 0,
      model: input.model ?? null,
      toolCalls: input.toolCalls ?? 0,
    },
  })
  if ((input.toolCalls ?? 0) > 0) {
    await recordAnalyticsEvent({
      institutionId: input.institutionId,
      userId: input.userId,
      userType: input.userType,
      courseId: input.courseId ?? null,
      sessionId: input.sessionId ?? null,
      eventType: "cora_tool_called",
      feature: "cora",
      workflow: input.workflowType ?? "cora",
      metadata: { toolCalls: input.toolCalls },
    })
  }
}
