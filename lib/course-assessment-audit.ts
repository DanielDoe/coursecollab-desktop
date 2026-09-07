import { sql } from "@/lib/db"
import type { AssessmentPrivilegeSource } from "@/lib/assessment-privilege-governance-shared"

export async function logCourseAssessmentAudit(params: {
  actorId: number
  actorType?: "instructor" | "admin"
  action: string
  courseId?: number | null
  entityType?: string
  entityId?: number | null
  oldValue?: unknown
  newValue?: unknown
  metadata?: Record<string, unknown>
}): Promise<void> {
  const metadata = {
    ...(params.metadata ?? {}),
    old_value: params.oldValue ?? null,
    new_value: params.newValue ?? null,
  }

  const courseId = params.courseId != null && params.courseId > 0 ? params.courseId : null

  await sql`
    INSERT INTO audit_logs (
      actor_id,
      actor_type,
      action,
      entity_type,
      entity_id,
      course_id,
      metadata
    )
    VALUES (
      ${params.actorId},
      ${params.actorType ?? "instructor"},
      ${params.action},
      ${params.entityType ?? "course_assessment_governance"},
      ${params.entityId ?? courseId},
      ${courseId},
      ${JSON.stringify(metadata)}::jsonb
    )
  `
}

export async function logAssessmentPrivilegeSourceChange(params: {
  actorId: number
  courseId: number
  oldSource: AssessmentPrivilegeSource
  newSource: AssessmentPrivilegeSource
}): Promise<void> {
  await logCourseAssessmentAudit({
    actorId: params.actorId,
    action: "assessment_privilege_source_updated",
    courseId: params.courseId,
    oldValue: params.oldSource,
    newValue: params.newSource,
  })
}

export async function logCoursePolicyNoticeChange(params: {
  actorId: number
  courseId: number
  oldVisible: boolean
  newVisible: boolean
}): Promise<void> {
  await logCourseAssessmentAudit({
    actorId: params.actorId,
    action: "course_policy_notice_visibility_updated",
    courseId: params.courseId,
    oldValue: params.oldVisible,
    newValue: params.newVisible,
  })
}

export async function logTradeCenterRulesChange(params: {
  actorId: number
  courseId?: number | null
  session: string
  oldValue: unknown
  newValue: unknown
}): Promise<void> {
  await logCourseAssessmentAudit({
    actorId: params.actorId,
    action: "trade_center_rules_updated",
    courseId: params.courseId,
    entityType: "trade_center_config",
    oldValue: params.oldValue,
    newValue: params.newValue,
    metadata: { session: params.session },
  })
}
