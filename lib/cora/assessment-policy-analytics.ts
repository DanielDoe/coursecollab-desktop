import { sql } from "@/lib/db"
import type { CoraAssessmentPolicyResult, CoraAssistanceCategory } from "@/lib/cora/assessment-policy"
import { recordAiLearningInteraction } from "@/lib/institutions/ai-learning-interactions"
import { recordAnalyticsEvent } from "@/lib/institutions/analytics-events"

let ready = false

export async function ensureCoraAssessmentEventsSchema(): Promise<void> {
  if (ready) return
  await sql`
    CREATE TABLE IF NOT EXISTS cora_assessment_events (
      id BIGSERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      institution_id INTEGER,
      assessment_id INTEGER,
      assessment_type TEXT,
      question_id INTEGER,
      question_bank_id INTEGER,
      question_type TEXT,
      attempt_id INTEGER,
      source TEXT NOT NULL,
      attempt_state TEXT NOT NULL,
      policy_mode TEXT NOT NULL,
      assistance_category TEXT,
      hint_level INTEGER,
      was_answer_seeking BOOLEAN NOT NULL DEFAULT false,
      answer_blocked BOOLEAN NOT NULL DEFAULT false,
      provided_conceptual_guidance BOOLEAN NOT NULL DEFAULT false,
      subsequent_correct BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS cora_assessment_events_student_idx
    ON cora_assessment_events (student_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS cora_assessment_events_course_idx
    ON cora_assessment_events (course_id, created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS cora_assessment_events_assessment_idx
    ON cora_assessment_events (assessment_id, question_id)`
  ready = true
}

export type RecordAskCoraEventInput = {
  studentId: number
  courseId?: number | null
  institutionId?: number | null
  assessmentId?: number | null
  assessmentType?: string | null
  questionId?: number | null
  bankQuestionId?: number | null
  questionType?: string | null
  attemptId?: number | null
  source: string
  policy: CoraAssessmentPolicyResult
  hintLevel?: number | null
  answerBlocked?: boolean
  providedConceptualGuidance?: boolean
  topic?: string | null
}

export async function recordAskCoraAssessmentEvent(input: RecordAskCoraEventInput): Promise<void> {
  try {
    await ensureCoraAssessmentEventsSchema()
    const attemptState = input.policy.attemptState.assessmentActive
      ? "active"
      : input.policy.attemptState.submitted
        ? input.policy.attemptState.solutionsReleased
          ? "released"
          : "submitted"
        : "unanswered"

    await sql`
      INSERT INTO cora_assessment_events (
        student_id, course_id, institution_id, assessment_id, assessment_type,
        question_id, question_bank_id, question_type, attempt_id, source,
        attempt_state, policy_mode, assistance_category, hint_level,
        was_answer_seeking, answer_blocked, provided_conceptual_guidance
      ) VALUES (
        ${input.studentId},
        ${input.courseId ?? null},
        ${input.institutionId ?? null},
        ${input.assessmentId ?? null},
        ${input.assessmentType ?? null},
        ${input.questionId ?? null},
        ${input.bankQuestionId ?? null},
        ${input.questionType ?? null},
        ${input.attemptId ?? null},
        ${input.source},
        ${attemptState},
        ${input.policy.mode},
        ${input.policy.assistanceCategory},
        ${input.hintLevel ?? 1},
        ${input.policy.answerSeeking},
        ${Boolean(input.answerBlocked)},
        ${input.providedConceptualGuidance ?? input.policy.assistanceCategory !== "answer_seeking"}
      )
    `

    if (input.institutionId && Number.isFinite(input.institutionId) && input.institutionId > 0) {
      await recordAnalyticsEvent({
        institutionId: input.institutionId,
        userId: input.studentId,
        userType: "student",
        courseId: input.courseId ?? null,
        eventType: input.answerBlocked ? "cora_message_sent" : "cora_response_received",
        feature: "ask_cora",
        workflow: input.source,
        assessmentId: input.assessmentId ?? null,
        questionId: input.questionId ?? null,
        metadata: {
          policyMode: input.policy.mode,
          assistanceCategory: input.policy.assistanceCategory,
          answerSeeking: input.policy.answerSeeking,
          answerBlocked: Boolean(input.answerBlocked),
          questionType: input.questionType ?? null,
        },
      })
      await recordAiLearningInteraction({
        institutionId: input.institutionId,
        studentId: input.studentId,
        courseId: input.courseId ?? null,
        conceptId: input.topic ?? input.questionType ?? null,
        workflowType: `ask_cora_${input.source}`,
        userMessage: input.policy.answerSeeking ? "answer-seeking" : "guided",
        activeAssessment: input.policy.attemptState.assessmentActive,
        assessmentId: input.assessmentId ?? null,
      })
    }
  } catch (err) {
    console.warn("[ask-cora-analytics] record failed", err)
  }
}

export type StudentAskCoraAssistance = {
  questionsAssisted: number
  conceptualHints: number
  debuggingSessions: number
  answerSeekingRedirected: number
  successRateAfterAssistance: number | null
}

export async function getStudentAskCoraAssistance(studentId: number): Promise<StudentAskCoraAssistance> {
  await ensureCoraAssessmentEventsSchema()
  const rows = (await sql`
    SELECT
      COUNT(DISTINCT COALESCE(question_id, question_bank_id))::int AS questions,
      COUNT(*) FILTER (WHERE assistance_category = 'conceptual_hint')::int AS conceptual,
      COUNT(*) FILTER (WHERE assistance_category = 'debugging')::int AS debugging,
      COUNT(*) FILTER (WHERE was_answer_seeking OR answer_blocked)::int AS redirected,
      COUNT(*) FILTER (WHERE subsequent_correct IS TRUE)::int AS later_correct,
      COUNT(*) FILTER (WHERE subsequent_correct IS NOT NULL)::int AS later_known
    FROM cora_assessment_events
    WHERE student_id = ${studentId}
  `) as Array<{
    questions: number
    conceptual: number
    debugging: number
    redirected: number
    later_correct: number
    later_known: number
  }>
  const row = rows[0]
  const known = Number(row?.later_known ?? 0)
  return {
    questionsAssisted: Number(row?.questions ?? 0),
    conceptualHints: Number(row?.conceptual ?? 0),
    debuggingSessions: Number(row?.debugging ?? 0),
    answerSeekingRedirected: Number(row?.redirected ?? 0),
    successRateAfterAssistance:
      known > 0 ? Math.round((Number(row?.later_correct ?? 0) / known) * 100) : null,
  }
}

export type FacultyAskCoraInsights = {
  requests: number
  students: number
  answerSeeking: number
  answerBlocked: number
  byAssessment: Array<{ assessmentId: number | null; assessmentType: string | null; requests: number }>
  byQuestion: Array<{ questionId: number | null; questionType: string | null; requests: number }>
  byCategory: Array<{ category: CoraAssistanceCategory | string; requests: number }>
  codeWriteRequests: number
  circuitRequests: number
}

export async function getFacultyAskCoraInsights(courseId: number): Promise<FacultyAskCoraInsights> {
  await ensureCoraAssessmentEventsSchema()
  const [totals, byAssessment, byQuestion, byCategory] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS requests,
        COUNT(DISTINCT student_id)::int AS students,
        COUNT(*) FILTER (WHERE was_answer_seeking)::int AS seeking,
        COUNT(*) FILTER (WHERE answer_blocked)::int AS blocked,
        COUNT(*) FILTER (WHERE question_type IN ('code_write', 'code_write_plot'))::int AS codewrite,
        COUNT(*) FILTER (WHERE question_type ILIKE '%circuit%')::int AS circuit
      FROM cora_assessment_events
      WHERE course_id = ${courseId}
        AND created_at >= NOW() - INTERVAL '30 days'
    `.catch(() => [{ requests: 0, students: 0, seeking: 0, blocked: 0, codewrite: 0, circuit: 0 }]),
    sql`
      SELECT assessment_id, assessment_type, COUNT(*)::int AS requests
      FROM cora_assessment_events
      WHERE course_id = ${courseId}
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY assessment_id, assessment_type
      ORDER BY requests DESC
      LIMIT 12
    `.catch(() => []),
    sql`
      SELECT question_id, question_type, COUNT(*)::int AS requests
      FROM cora_assessment_events
      WHERE course_id = ${courseId}
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY question_id, question_type
      ORDER BY requests DESC
      LIMIT 12
    `.catch(() => []),
    sql`
      SELECT COALESCE(assistance_category, 'other') AS category, COUNT(*)::int AS requests
      FROM cora_assessment_events
      WHERE course_id = ${courseId}
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY requests DESC
    `.catch(() => []),
  ])

  const total = (totals as Array<Record<string, number>>)[0] ?? {}
  return {
    requests: Number(total.requests ?? 0),
    students: Number(total.students ?? 0),
    answerSeeking: Number(total.seeking ?? 0),
    answerBlocked: Number(total.blocked ?? 0),
    codeWriteRequests: Number(total.codewrite ?? 0),
    circuitRequests: Number(total.circuit ?? 0),
    byAssessment: (byAssessment as Array<Record<string, unknown>>).map((row) => ({
      assessmentId: row.assessment_id != null ? Number(row.assessment_id) : null,
      assessmentType: row.assessment_type != null ? String(row.assessment_type) : null,
      requests: Number(row.requests ?? 0),
    })),
    byQuestion: (byQuestion as Array<Record<string, unknown>>).map((row) => ({
      questionId: row.question_id != null ? Number(row.question_id) : null,
      questionType: row.question_type != null ? String(row.question_type) : null,
      requests: Number(row.requests ?? 0),
    })),
    byCategory: (byCategory as Array<Record<string, unknown>>).map((row) => ({
      category: String(row.category ?? "other"),
      requests: Number(row.requests ?? 0),
    })),
  }
}

export type InstitutionAskCoraInsights = {
  adoptionStudents: number
  requests: number
  answerProtections: number
  conceptualGuidance: number
  assistedPerformanceKnown: number
  assistedSuccessRate: number | null
}

export async function getInstitutionAskCoraInsights(institutionId: number): Promise<InstitutionAskCoraInsights> {
  await ensureCoraAssessmentEventsSchema()
  const rows = (await sql`
    SELECT
      COUNT(DISTINCT student_id)::int AS students,
      COUNT(*)::int AS requests,
      COUNT(*) FILTER (WHERE answer_blocked OR was_answer_seeking)::int AS protections,
      COUNT(*) FILTER (WHERE provided_conceptual_guidance)::int AS conceptual,
      COUNT(*) FILTER (WHERE subsequent_correct IS NOT NULL)::int AS known,
      COUNT(*) FILTER (WHERE subsequent_correct IS TRUE)::int AS success
    FROM cora_assessment_events
    WHERE institution_id = ${institutionId}
      AND created_at >= NOW() - INTERVAL '30 days'
  `) as Array<{
    students: number
    requests: number
    protections: number
    conceptual: number
    known: number
    success: number
  }>
  const row = rows[0]
  const known = Number(row?.known ?? 0)
  return {
    adoptionStudents: Number(row?.students ?? 0),
    requests: Number(row?.requests ?? 0),
    answerProtections: Number(row?.protections ?? 0),
    conceptualGuidance: Number(row?.conceptual ?? 0),
    assistedPerformanceKnown: known,
    assistedSuccessRate: known > 0 ? Math.round((Number(row?.success ?? 0) / known) * 100) : null,
  }
}

export async function resolveStudentInstitutionId(studentId: number): Promise<number | null> {
  try {
    const rows = (await sql`
      SELECT institution_id
      FROM institution_members
      WHERE user_type = 'student'
        AND user_id = ${studentId}
      LIMIT 1
    `) as Array<{ institution_id: number | null }>
    const id = rows[0]?.institution_id
    return id != null ? Number(id) : null
  } catch {
    return null
  }
}
