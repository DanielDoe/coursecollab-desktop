import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { recordAnalyticsEvent } from "@/lib/institutions/analytics-events"
import { getStudentsNeedingAttention } from "@/lib/institutions/metrics/queries"
import type { InstitutionScope } from "@/lib/institutions/metrics/types"

export type InterventionType =
  | "targeted_practice"
  | "concept_review"
  | "cora_tutoring"
  | "flashcards"
  | "study_plan"
  | "instructor_message"
  | "reminder"
  | "office_hour_recommendation"
  | "practice_recommendation"
  | "assessment_review"

const REASON_TO_TYPE: Record<string, InterventionType> = {
  inactive: "reminder",
  multiple_missing_assessments: "assessment_review",
  declining_performance: "targeted_practice",
  low_assessment_performance: "concept_review",
  needs_attention: "practice_recommendation",
}

const REASON_TO_TRIGGER: Record<string, string> = {
  inactive: "inactivity_14d",
  multiple_missing_assessments: "missing_submissions",
  declining_performance: "declining_scores",
  low_assessment_performance: "low_mastery",
  needs_attention: "attention_heuristic",
}

export async function triggerIntervention(input: {
  institutionId: number
  studentId: number
  courseId?: number | null
  trigger: string
  interventionType: InterventionType
  channel?: string
  contentSummary?: string
  coraInvolved?: boolean
  metadata?: Record<string, unknown>
}): Promise<number | null> {
  try {
    await ensureInstitutionSchema()
    const rows = (await sql`
      INSERT INTO institution_interventions (
        institution_id, student_id, course_id, trigger, intervention_type,
        channel, content_summary, cora_involved, triggered_at, metadata_json
      ) VALUES (
        ${input.institutionId},
        ${input.studentId},
        ${input.courseId ?? null},
        ${input.trigger},
        ${input.interventionType},
        ${input.channel ?? "platform"},
        ${input.contentSummary ?? null},
        ${Boolean(input.coraInvolved)},
        NOW(),
        ${JSON.stringify(input.metadata ?? {})}::jsonb
      )
      RETURNING id
    `) as Array<{ id: number }>
    const id = rows[0]?.id ?? null
    await recordAnalyticsEvent({
      institutionId: input.institutionId,
      userId: input.studentId,
      userType: "student",
      courseId: input.courseId ?? null,
      eventType: "intervention_triggered",
      feature: "interventions",
      metadata: {
        interventionId: id,
        interventionType: input.interventionType,
        trigger: input.trigger,
      },
    })
    return id
  } catch (err) {
    console.warn("[interventions] trigger failed", err)
    return null
  }
}

export async function markInterventionDelivered(
  interventionId: number,
  institutionId: number,
): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    UPDATE institution_interventions
    SET delivered_at = COALESCE(delivered_at, NOW())
    WHERE id = ${interventionId} AND institution_id = ${institutionId}
  `
  await recordAnalyticsEvent({
    institutionId,
    eventType: "intervention_delivered",
    feature: "interventions",
    metadata: { interventionId },
  })
}

export async function markInterventionViewed(interventionId: number, institutionId: number): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    UPDATE institution_interventions
    SET viewed_at = COALESCE(viewed_at, NOW()),
        delivered_at = COALESCE(delivered_at, NOW())
    WHERE id = ${interventionId} AND institution_id = ${institutionId}
  `
  await recordAnalyticsEvent({
    institutionId,
    eventType: "intervention_viewed",
    feature: "interventions",
    metadata: { interventionId },
  })
}

export async function markInterventionEngaged(interventionId: number, institutionId: number, studentId?: number): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    UPDATE institution_interventions
    SET engaged_at = COALESCE(engaged_at, NOW()),
        viewed_at = COALESCE(viewed_at, NOW()),
        delivered_at = COALESCE(delivered_at, NOW())
    WHERE id = ${interventionId} AND institution_id = ${institutionId}
  `
  await recordAnalyticsEvent({
    institutionId,
    userId: studentId ?? null,
    userType: studentId ? "student" : null,
    eventType: "intervention_engaged",
    feature: "interventions",
    metadata: { interventionId },
  })
}

export async function markInterventionCompleted(interventionId: number, institutionId: number): Promise<void> {
  await ensureInstitutionSchema()
  await sql`
    UPDATE institution_interventions
    SET completed_at = COALESCE(completed_at, NOW()),
        engaged_at = COALESCE(engaged_at, NOW()),
        viewed_at = COALESCE(viewed_at, NOW()),
        delivered_at = COALESCE(delivered_at, NOW())
    WHERE id = ${interventionId} AND institution_id = ${institutionId}
  `
  await recordAnalyticsEvent({
    institutionId,
    eventType: "intervention_completed",
    feature: "interventions",
    metadata: { interventionId },
  })
}

/** Create intervention rows for attention-flagged students (deduped per 7 days). */
export async function syncAttentionInterventions(scope: InstitutionScope): Promise<number> {
  if (scope.courseIds.length === 0) return 0
  const flagged = await getStudentsNeedingAttention(scope, 50)
  let created = 0
  for (const row of flagged) {
    const licenses = (await sql`
      SELECT institution_id FROM institution_licenses
      WHERE institution_id = ${scope.institutionId} AND status = 'active'
      LIMIT 1
    `) as Array<{ institution_id: number }>
    if (!licenses[0]) continue
    const existing = (await sql`
      SELECT id FROM institution_interventions
      WHERE institution_id = ${scope.institutionId}
        AND student_id = ${row.studentId}
        AND trigger = ${REASON_TO_TRIGGER[row.reason] ?? "attention_heuristic"}
        AND triggered_at >= NOW() - INTERVAL '7 days'
      LIMIT 1
    `) as Array<{ id: number }>
    if (existing.length > 0) continue
    const id = await triggerIntervention({
      institutionId: scope.institutionId,
      studentId: row.studentId,
      courseId: row.courseId,
      trigger: REASON_TO_TRIGGER[row.reason] ?? "attention_heuristic",
      interventionType: REASON_TO_TYPE[row.reason] ?? "practice_recommendation",
      channel: "analytics",
      contentSummary: row.recommendedAction,
      metadata: { reason: row.reason, heuristic: true },
    })
    if (id) created += 1
  }
  return created
}

/** When a student notification is sent, link to the latest open intervention. */
export async function deliverInterventionViaNotification(input: {
  studentId: number
  notificationType: string
  title: string
}): Promise<void> {
  try {
    const row = (await sql`
      SELECT i.id, i.institution_id
      FROM institution_interventions i
      WHERE i.student_id = ${input.studentId}
        AND i.delivered_at IS NULL
      ORDER BY i.triggered_at DESC
      LIMIT 1
    `) as Array<{ id: number; institution_id: number }>
    if (!row[0]) return
    await sql`
      UPDATE institution_interventions
      SET delivered_at = NOW(),
          channel = 'notification',
          content_summary = COALESCE(content_summary, ${input.title})
      WHERE id = ${Number(row[0].id)}
    `
    await recordAnalyticsEvent({
      institutionId: Number(row[0].institution_id),
      userId: input.studentId,
      userType: "student",
      eventType: "intervention_delivered",
      feature: "interventions",
      metadata: { notificationType: input.notificationType },
    })
  } catch {
    /* non-blocking */
  }
}

export type StudentInterventionRow = {
  id: number
  institutionId: number
  interventionType: InterventionType
  trigger: string
  contentSummary: string | null
  courseId: number | null
  triggeredAt: string
  href: string
  actionLabel: string
}

const TYPE_HREF: Record<InterventionType, { href: string; label: string }> = {
  targeted_practice: { href: "/student/practice", label: "Start targeted practice" },
  concept_review: { href: "/student/practice", label: "Review concepts" },
  cora_tutoring: { href: "/student/ai-tutor", label: "Open Cora tutor" },
  flashcards: { href: "/student/flashcards", label: "Review flashcards" },
  study_plan: { href: "/student/ai-tutor", label: "Open study plan" },
  instructor_message: { href: "/student/messages", label: "View message" },
  reminder: { href: "/student/dashboard-v2", label: "View dashboard" },
  office_hour_recommendation: { href: "/student/office-hours", label: "Book office hours" },
  practice_recommendation: { href: "/student/practice", label: "Practice now" },
  assessment_review: { href: "/student/dashboard-v2/grades", label: "Review assessments" },
}

export async function listOpenInterventionsForStudent(studentId: number): Promise<StudentInterventionRow[]> {
  await ensureInstitutionSchema()
  const rows = (await sql`
    SELECT id, institution_id, intervention_type, trigger, content_summary, course_id, triggered_at
    FROM institution_interventions
    WHERE student_id = ${studentId}
      AND completed_at IS NULL
      AND triggered_at >= NOW() - INTERVAL '14 days'
    ORDER BY triggered_at DESC
    LIMIT 5
  `.catch(() => [])) as Array<Record<string, unknown>>

  return rows.map((row) => {
    const type = String(row.intervention_type ?? "practice_recommendation") as InterventionType
    const link = TYPE_HREF[type] ?? TYPE_HREF.practice_recommendation
    const id = Number(row.id)
    const sep = link.href.includes("?") ? "&" : "?"
    return {
      id,
      institutionId: Number(row.institution_id),
      interventionType: type,
      trigger: String(row.trigger ?? ""),
      contentSummary: row.content_summary != null ? String(row.content_summary) : null,
      courseId: row.course_id != null ? Number(row.course_id) : null,
      triggeredAt: String(row.triggered_at ?? ""),
      href: `${link.href}${sep}interventionId=${id}`,
      actionLabel: link.label,
    }
  })
}

export async function advanceStudentIntervention(input: {
  studentId: number
  interventionId: number
  action: "viewed" | "engaged" | "completed"
}): Promise<boolean> {
  const rows = (await sql`
    SELECT id, institution_id FROM institution_interventions
    WHERE id = ${input.interventionId} AND student_id = ${input.studentId}
    LIMIT 1
  `.catch(() => [])) as Array<{ id: number; institution_id: number }>
  const row = rows[0]
  if (!row) return false
  const institutionId = Number(row.institution_id)
  if (input.action === "viewed") {
    await markInterventionViewed(input.interventionId, institutionId)
  } else if (input.action === "engaged") {
    await markInterventionEngaged(input.interventionId, institutionId, input.studentId)
  } else {
    await markInterventionCompleted(input.interventionId, institutionId)
  }
  return true
}

/** Mark viewed when student opens a recommendation; engaged/completed on follow-through. */
export async function markInterventionsViewedForStudent(studentId: number, interventionIds: number[]): Promise<void> {
  for (const id of interventionIds) {
    await advanceStudentIntervention({ studentId, interventionId: id, action: "viewed" }).catch(() => undefined)
  }
}

/** Mark engaged when student completes practice after a delivered intervention. */
export async function engageInterventionsAfterPractice(studentId: number): Promise<void> {
  try {
    const rows = (await sql`
      SELECT id, institution_id
      FROM institution_interventions
      WHERE student_id = ${studentId}
        AND delivered_at IS NOT NULL
        AND completed_at IS NULL
        AND triggered_at >= NOW() - INTERVAL '14 days'
      ORDER BY triggered_at DESC
      LIMIT 3
    `.catch(() => [])) as Array<{ id: number; institution_id: number }>

    for (const row of rows) {
      await markInterventionEngaged(Number(row.id), Number(row.institution_id), studentId)
      await markInterventionCompleted(Number(row.id), Number(row.institution_id))
    }
  } catch {
    /* non-blocking */
  }
}
