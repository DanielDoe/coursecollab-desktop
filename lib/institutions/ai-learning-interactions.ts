import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { classifyAssistanceFromSignals } from "@/lib/institutions/ai-assistance-classifier"
import { recordAnalyticsEvent } from "@/lib/institutions/analytics-events"
import { researchStudentId } from "@/lib/institutions/research/research-ids"

export type RecordAiLearningInteractionInput = {
  institutionId: number
  studentId: number
  courseId?: number | null
  conceptId?: string | null
  sessionId?: string | null
  coraUsageId?: number | null
  workflowType?: string | null
  userMessage?: string | null
  learningGoal?: string | null
  toolNames?: string[]
  activeAssessment?: boolean
  assessmentId?: number | null
  attemptCountBeforeAi?: number | null
  credits?: number | null
  latencyMs?: number | null
}

/** Persist inferred AI learning interaction row + analytics event. Best-effort. */
export async function recordAiLearningInteraction(input: RecordAiLearningInteractionInput): Promise<number | null> {
  if (!Number.isFinite(input.institutionId) || !Number.isFinite(input.studentId)) return null
  try {
    await ensureInstitutionSchema()
    const classification = classifyAssistanceFromSignals({
      workflowType: input.workflowType,
      userMessage: input.userMessage,
      learningGoal: input.learningGoal,
      toolNames: input.toolNames,
      activeAssessment: input.activeAssessment,
    })
    const researchStudentIdValue = researchStudentId(input.institutionId, input.studentId)

    const rows = (await sql`
      INSERT INTO ai_learning_interactions (
        institution_id,
        research_student_id,
        student_id,
        course_id,
        concept_id,
        session_id,
        cora_usage_id,
        assessment_id,
        assistance_type,
        assistance_depth,
        classification_confidence,
        attempt_count_before_ai,
        active_assessment_context,
        credits,
        latency_ms,
        metadata_json
      ) VALUES (
        ${input.institutionId},
        ${researchStudentIdValue},
        ${input.studentId},
        ${input.courseId ?? null},
        ${input.conceptId ?? null},
        ${input.sessionId ?? null},
        ${input.coraUsageId ?? null},
        ${input.assessmentId ?? null},
        ${classification.assistanceType},
        ${classification.assistanceDepth},
        ${classification.classificationConfidence},
        ${input.attemptCountBeforeAi ?? null},
        ${Boolean(input.activeAssessment)},
        ${input.credits ?? null},
        ${input.latencyMs ?? null},
        ${JSON.stringify({
          workflowType: input.workflowType ?? null,
          toolNames: input.toolNames ?? [],
        })}::jsonb
      )
      RETURNING id
    `) as Array<{ id: number }>

    await recordAnalyticsEvent({
      institutionId: input.institutionId,
      userId: input.studentId,
      userType: "student",
      courseId: input.courseId ?? null,
      sessionId: input.sessionId ?? null,
      eventType: "cora_response_received",
      feature: "cora",
      workflow: input.workflowType ?? "cora",
      conceptId: input.conceptId ?? null,
      assessmentId: input.assessmentId ?? null,
      durationMs: input.latencyMs ?? null,
      metadata: {
        assistanceType: classification.assistanceType,
        assistanceDepth: classification.assistanceDepth,
        classificationConfidence: classification.classificationConfidence,
      },
    })

    return rows[0]?.id ?? null
  } catch (err) {
    console.warn("[ai-learning-interactions] record failed", err)
    return null
  }
}

/** Link subsequent practice/assessment outcomes to a recent interaction (best-effort batch). */
export async function backfillAiInteractionOutcomes(scope: {
  institutionId: number
  from: string
  to: string
}): Promise<void> {
  try {
    await ensureInstitutionSchema()
    await sql`
      WITH recent AS (
        SELECT i.id, i.student_id, i.course_id, i.created_at
        FROM ai_learning_interactions i
        WHERE i.institution_id = ${scope.institutionId}
          AND i.created_at::date >= ${scope.from}::date
          AND i.created_at::date <= ${scope.to}::date
          AND i.next_attempt_correct IS NULL
      ),
      practice_after AS (
        SELECT
          r.id AS interaction_id,
          pa.id AS attempt_id,
          paa.is_correct,
          EXTRACT(EPOCH FROM (COALESCE(pa.started_at, pa.completed_at) - r.created_at)) / 3600.0 AS hours_after
        FROM recent r
        JOIN practice_attempts pa ON pa.student_id = r.student_id
        LEFT JOIN practice_answers paa ON paa.attempt_id = pa.id
        WHERE COALESCE(pa.started_at, pa.completed_at) > r.created_at
          AND COALESCE(pa.started_at, pa.completed_at) <= r.created_at + INTERVAL '7 days'
          AND (r.course_id IS NULL OR pa.student_id IN (
            SELECT st.id FROM students st WHERE st.course_id = r.course_id
          ))
      ),
      best_practice AS (
        SELECT DISTINCT ON (interaction_id)
          interaction_id, is_correct, hours_after
        FROM practice_after
        ORDER BY interaction_id, hours_after ASC
      )
      UPDATE ai_learning_interactions i
      SET
        student_attempt_after_ai = true,
        time_to_next_attempt_hours = bp.hours_after,
        next_attempt_correct = bp.is_correct,
        updated_at = NOW()
      FROM best_practice bp
      WHERE i.id = bp.interaction_id
    `
  } catch (err) {
    console.warn("[ai-learning-interactions] backfill failed", err)
  }
}
