import { sql } from "@/lib/db"
import { createNotification } from "@/lib/create-notification"
import {
  assertGroupSizeForProject,
  assertGroupSizeWithinPolicy,
  assertStudentSelfFormAllowed,
} from "@/lib/project-policy-enforcement"
import { getActiveSemesterKey, logRecommendationAudit, RECOMMENDATION_PURPOSES, ensureInstructorRecommendationSettings } from "@/lib/recommendation-letters"
import { notifyRecommendationInstructor } from "@/lib/recommendation-instructor-email"
import { notifyRecommendationStudent } from "@/lib/recommendation-student-email"
import { clampClassroomPointsForDb, ensureClassroomPointsSchema } from "@/lib/ensure-classroom-points-schema"
import {
  CLASSROOM_BASE_POINTS,
  resolveClassroomSubmissionBooster,
  timingBoosterLabel,
} from "@/lib/classroom-point-booster"
import {
  CLASSROOM_SOLUTION_POINTS_CATEGORY,
  isClassroomSolutionAssignment,
  parseClassroomSolutionQuestionConfig,
} from "@/lib/classroom-solution-submission"
import {
  compactCircuitSubmissionForSubmit,
  circuitSubmissionHasRequiredUpload,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import { getRewardsPolicyForStudent } from "@/lib/rewards-policy.server"
import { resolveClassroomAwardInstructorId } from "@/lib/classroom-points-award-instructor"
import { autoEvaluateClassroomSolutionSubmission } from "@/lib/classroom-points-auto-evaluate"
import {
  registerCapabilityHandlers,
  type CapabilityExecutionContext,
  type CapabilityHandlerResult,
} from "@/lib/cora/services/capability-handler-registry"

function studentId(ctx: CapabilityExecutionContext): number {
  const id = ctx.studentDbId
  if (!id || !Number.isFinite(id) || id <= 0) throw new Error("Student context required.")
  return id
}

function positiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

function textValue(value: unknown): string {
  return String(value ?? "").trim()
}

function unsupported(message: string): CapabilityHandlerResult {
  return { success: false, message, error: "unsupported" }
}

function policyFailure(message = "This action is blocked by course policy."): CapabilityHandlerResult {
  return { success: false, message, error: "policy_violation" }
}

async function handleGroupCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const name = textValue(ctx.args.name ?? ctx.args.title)
  if (!name) {
    return { success: false, message: "Group name is required.", error: "invalid_args" }
  }

  const studentRows = (await sql`
    SELECT id, section, student_id, full_name, session_id
    FROM students
    WHERE id = ${studentDbId}
    LIMIT 1
  `) as { id: number; section: string | null; student_id: string | null; full_name: string | null; session_id: number | null }[]

  if (studentRows.length === 0) {
    return { success: false, message: "Student not found.", error: "not_found" }
  }

  const student = studentRows[0]
  // Default to the student's own section; if provided, it must match (mirrors API check).
  const session = textValue(ctx.args.session) || student.section || ""
  if (!session) {
    return { success: false, message: "Could not resolve your session/section.", error: "invalid_args" }
  }
  if (student.section !== session) {
    return { success: false, message: "Student does not belong to this session.", error: "forbidden" }
  }

  const sessionRows = (await sql`
    SELECT course_id
    FROM sessions
    WHERE id = ${student.session_id}
    LIMIT 1
  `) as { course_id?: number | null }[]
  const courseId = sessionRows[0]?.course_id ?? null

  const selfForm = await assertStudentSelfFormAllowed(courseId, false)
  if (!selfForm.ok) return policyFailure()
  const size = await assertGroupSizeWithinPolicy(courseId, 1)
  if (!size.ok) return policyFailure()

  const groupRows = (await sql`
    INSERT INTO groups (name, session, created_by, status, course_id)
    VALUES (${name}, ${session}, ${studentDbId}, 'approved', ${courseId})
    RETURNING id, name, session
  `) as { id: number; name: string; session: string }[]

  const group = groupRows[0]
  if (!group) {
    return { success: false, message: "Failed to create group.", error: "write_failed" }
  }

  await sql`
    INSERT INTO group_members (group_id, student_id)
    VALUES (${group.id}, ${studentDbId})
  `

  return {
    success: true,
    message: `Group "${group.name}" created.`,
    entity: { type: "group", id: group.id, title: group.name, route: "/module/projects" },
  }
}

async function handleGroupJoin(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const groupId = positiveInt(ctx.args.groupId ?? ctx.args.id)
  if (!groupId) {
    return { success: false, message: "Group ID is required.", error: "invalid_args" }
  }

  const targetGroup = (await sql`
    SELECT id, course_id, name, created_by
    FROM groups
    WHERE id = ${groupId}
    LIMIT 1
  `) as { id: number; course_id?: number | null; name: string; created_by?: number | null }[]
  if (targetGroup.length === 0) {
    return { success: false, message: "Group not found.", error: "not_found" }
  }

  const joinCourseId = targetGroup[0].course_id ?? null
  const selfForm = await assertStudentSelfFormAllowed(joinCourseId, false)
  if (!selfForm.ok) return policyFailure()

  const memberCountRows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM group_members
    WHERE group_id = ${groupId}
  `) as { count?: number }[]
  const nextMemberCount = Number(memberCountRows[0]?.count ?? 0) + 1
  const size = await assertGroupSizeWithinPolicy(joinCourseId, nextMemberCount)
  if (!size.ok) return policyFailure()

  const existingMembership = (await sql`
    SELECT gm.id
    FROM group_members gm
    JOIN groups g ON gm.group_id = g.id
    WHERE gm.student_id = ${studentDbId}
      AND g.deleted_at IS NULL
      AND g.status IN ('pending', 'approved', 'pending_update')
    LIMIT 1
  `) as { id: number }[]
  if (existingMembership.length > 0) {
    return {
      success: false,
      message: "You're already in a group. Leave your current group to join another.",
      error: "duplicate_membership",
    }
  }

  const existingRequest = (await sql`
    SELECT id
    FROM group_join_requests
    WHERE group_id = ${groupId}
      AND requester_student_id = ${studentDbId}
      AND status = 'pending'
    LIMIT 1
  `) as { id: number }[]
  if (existingRequest.length > 0) {
    return {
      success: false,
      message: "You already have a pending request for this group.",
      error: "duplicate_request",
    }
  }

  await sql`
    INSERT INTO group_join_requests (group_id, requester_student_id, status)
    VALUES (${groupId}, ${studentDbId}, 'pending')
  `

  const groupInfo = (await sql`
    SELECT g.name, g.created_by, s.full_name AS requester_name
    FROM groups g
    JOIN students s ON s.id = ${studentDbId}
    WHERE g.id = ${groupId}
    LIMIT 1
  `) as { name: string; created_by: number | null; requester_name: string }[]

  if (groupInfo[0]?.created_by) {
    await createNotification({
      studentId: groupInfo[0].created_by,
      type: "group",
      title: "New group join request",
      message: `${groupInfo[0].requester_name} requested to join "${groupInfo[0].name}".`,
      link: `/student/dashboard-v2/groups/${groupId}`,
    }).catch((err) => console.warn("[student capability] group join notification failed:", err))
  }

  return {
    success: true,
    message: "Join request sent successfully.",
    entity: { type: "group_join_request", id: groupId, title: groupInfo[0]?.name ?? "Group", route: "/module/projects" },
  }
}

async function handleGroupLeave(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const activeMembership = (await sql`
    SELECT gm.id, gm.group_id, g.name
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.student_id = ${studentDbId}
      AND g.deleted_at IS NULL
      AND g.status IN ('pending', 'approved', 'pending_update')
    ORDER BY gm.id ASC
    LIMIT 1
  `) as { id: number; group_id: number; name: string }[]

  if (activeMembership.length === 0) {
    return { success: false, message: "No active group membership was found.", error: "not_found" }
  }

  const membershipId = activeMembership[0].id
  const deleted = (await sql`
    DELETE FROM group_members
    WHERE id = ${membershipId} AND student_id = ${studentDbId}
    RETURNING id
  `) as { id: number }[]

  if (deleted.length === 0) {
    return { success: false, message: "Could not leave the group.", error: "write_failed" }
  }

  return {
    success: true,
    message: `Left group "${activeMembership[0].name}".`,
    entity: { type: "group", id: activeMembership[0].group_id, title: activeMembership[0].name, route: "/module/projects" },
  }
}

async function handleProjectCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const groupId = positiveInt(ctx.args.groupId ?? ctx.args.group_id)
  const title = textValue(ctx.args.title)
  if (!groupId || !title) {
    return { success: false, message: "Group ID and title are required.", error: "invalid_args" }
  }

  const groupRows = (await sql`
    SELECT id, created_by, status, course_id, session
    FROM groups
    WHERE id = ${groupId}
    LIMIT 1
  `) as { id: number; created_by: number; status: string; course_id?: number | null; session?: string | null }[]
  if (groupRows.length === 0) {
    return { success: false, message: "Group not found.", error: "not_found" }
  }

  const group = groupRows[0]
  if (group.status !== "approved") {
    return { success: false, message: "Projects can only be created for approved groups.", error: "forbidden" }
  }

  const membership = (await sql`
    SELECT 1
    FROM group_members
    WHERE group_id = ${groupId}
      AND student_id = ${studentDbId}
    LIMIT 1
  `) as { "1": number }[]
  if (membership.length === 0) {
    return { success: false, message: "You must be a member of this group.", error: "forbidden" }
  }
  if (Number(group.created_by) !== studentDbId) {
    return { success: false, message: "Only the group leader can create projects.", error: "forbidden" }
  }

  const memberCountRows = (await sql`
    SELECT COUNT(*)::int AS count
    FROM group_members
    WHERE group_id = ${groupId}
  `) as { count?: number }[]
  const projectSize = await assertGroupSizeForProject(group.course_id ?? null, Number(memberCountRows[0]?.count ?? 0))
  if (!projectSize.ok) return policyFailure()

  const projectRows = (await sql`
    INSERT INTO projects (
      group_id,
      title,
      summary,
      deliverables,
      target_platform,
      status,
      course_id
    )
    VALUES (
      ${groupId},
      ${title},
      ${ctx.args.summary ?? null},
      ${ctx.args.deliverables ?? null},
      ${ctx.args.targetPlatform ?? ctx.args.target_platform ?? null},
      'pending',
      ${group.course_id ?? null}
    )
    RETURNING id, group_id, title, summary, deliverables, target_platform, status
  `) as { id: number; group_id: number; title: string; summary: string | null; deliverables: string | null; target_platform: string | null; status: string }[]

  const project = projectRows[0]
  if (!project) {
    return { success: false, message: "Failed to create project.", error: "write_failed" }
  }

  return {
    success: true,
    message: `Project "${project.title}" created.`,
    entity: { type: "project", id: project.id, title: project.title, route: "/module/projects" },
    data: { status: project.status },
  }
}

async function handleProjectUpdate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const projectId = positiveInt(ctx.args.projectId ?? ctx.args.id)
  const title = textValue(ctx.args.title)
  if (!projectId || !title) {
    return { success: false, message: "Project ID and title are required.", error: "invalid_args" }
  }

  const projectCheck = (await sql`
    SELECT p.id, p.group_id, p.status, p.title AS current_title, p.summary AS current_summary,
      p.deliverables AS current_deliverables, p.target_platform AS current_target_platform,
      p.project_link AS current_project_link, g.created_by, g.status AS group_status
    FROM projects p
    JOIN groups g ON p.group_id = g.id
    WHERE p.id = ${projectId}
    LIMIT 1
  `) as {
    id: number
    group_id: number
    status: string
    current_title: string
    current_summary: string | null
    current_deliverables: string | null
    current_target_platform: string | null
    current_project_link: string | null
    created_by: number
    group_status: string
  }[]

  if (projectCheck.length === 0) {
    return { success: false, message: "Project not found.", error: "not_found" }
  }

  const project = projectCheck[0]
  const membership = (await sql`
    SELECT 1
    FROM group_members
    WHERE group_id = ${project.group_id}
      AND student_id = ${studentDbId}
    LIMIT 1
  `) as { "1": number }[]
  if (membership.length === 0) {
    return { success: false, message: "You must be a member of this project group.", error: "forbidden" }
  }
  if (Number(project.created_by) !== studentDbId) {
    return { success: false, message: "Only the group leader can edit the project.", error: "forbidden" }
  }

  const titleChanged = project.current_title !== title
  const summaryChanged = (project.current_summary || "") !== textValue(ctx.args.summary ?? "")
  const deliverablesChanged = (project.current_deliverables || "") !== textValue(ctx.args.deliverables ?? "")
  const platformChanged = (project.current_target_platform || "") !== textValue(ctx.args.targetPlatform ?? ctx.args.target_platform ?? "")
  const linkChanged = (project.current_project_link || "") !== textValue(ctx.args.projectLink ?? ctx.args.project_link ?? "")
  const isLinkOnlyUpdate = linkChanged && !titleChanged && !summaryChanged && !deliverablesChanged && !platformChanged
  const newStatus = isLinkOnlyUpdate ? project.status : "pending"

  const updated = (await sql`
    UPDATE projects
    SET
      title = ${title},
      summary = ${ctx.args.summary ?? null},
      deliverables = ${ctx.args.deliverables ?? null},
      target_platform = ${ctx.args.targetPlatform ?? ctx.args.target_platform ?? null},
      project_link = ${ctx.args.projectLink ?? ctx.args.project_link ?? null},
      status = ${newStatus},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${projectId}
    RETURNING id, group_id, title, status
  `) as { id: number; group_id: number; title: string; status: string }[]

  if (updated.length === 0) {
    return { success: false, message: "Failed to update project.", error: "write_failed" }
  }

  return {
    success: true,
    message: `Project "${updated[0].title}" updated.`,
    entity: { type: "project", id: updated[0].id, title: updated[0].title, route: "/module/projects" },
    data: { status: updated[0].status },
  }
}

async function handleClassroomPointsSubmit(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const submissionId = positiveInt(ctx.args.submissionId ?? ctx.args.assignmentId)
  const studentAnswer = ctx.args.studentAnswer ?? ctx.args.answer ?? ctx.args.solution
  if (!submissionId || studentAnswer == null) {
    return { success: false, message: "submissionId and studentAnswer are required.", error: "invalid_args" }
  }

  await ensureClassroomPointsSchema()

  const assignmentRows = (await sql`
    SELECT id, title, created_at, session, duration_hours, due_at, submission_kind, question_config, created_by,
      CASE
        WHEN due_at IS NOT NULL THEN due_at
        WHEN duration_hours IS NULL THEN NULL
        ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
      END AS expiry_time,
      COALESCE(due_at, created_at + ((COALESCE(duration_hours, 168)) * INTERVAL '1 hour')) AS deadline
    FROM classroom_point_submissions
    WHERE id = ${submissionId}
      AND (
        CASE
          WHEN due_at IS NOT NULL THEN due_at > NOW()
          WHEN duration_hours IS NULL THEN false
          ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
        END
      )
    LIMIT 1
  `) as {
    id: number
    title: string
    created_at: string
    session: string
    duration_hours: number | null
    due_at: string | null
    submission_kind?: string
    question_config?: unknown
    created_by?: number
    expiry_time?: string | null
    deadline?: string | null
  }[]

  if (assignmentRows.length === 0) {
    return { success: false, message: "Assignment not found or expired.", error: "not_found" }
  }

  const assignment = assignmentRows[0]
  if (!isClassroomSolutionAssignment(assignment.submission_kind)) {
    return { success: false, message: "This assignment is not a solution submission assignment.", error: "unsupported" }
  }

  const questionConfig = parseClassroomSolutionQuestionConfig(assignment.question_config)
  const uploadConfig = parseCircuitSubmissionConfig(questionConfig?.solution_upload_config ?? null)
  const compactJson = compactCircuitSubmissionForSubmit(studentAnswer)
  if (!circuitSubmissionHasRequiredUpload(compactJson, uploadConfig)) {
    return {
      success: false,
      message: "Upload at least one file or write your solution in the workspace before submitting.",
      error: "validation_failed",
    }
  }

  const parsed = parseCircuitSubmissionAnswer(compactJson)
  const answerForStore = JSON.stringify({ ...parsed, submission_status: "submitted" })

  const studentInfo = (await sql`
    SELECT id, section
    FROM students
    WHERE id = ${studentDbId}
    LIMIT 1
  `) as { id: number; section: string | null }[]
  if (studentInfo.length === 0) {
    return { success: false, message: "Student not found.", error: "not_found" }
  }
  const student = studentInfo[0]

  const rewardsPolicy = await getRewardsPolicyForStudent(student.id)
  if (!rewardsPolicy.allow_student_submissions) {
    return {
      success: false,
      message: "Student submissions are disabled for this course. Contact your instructor.",
      error: "forbidden",
    }
  }

  const existing = (await sql`
    SELECT id, status
    FROM classroom_points
    WHERE student_id = ${student.id}
      AND submission_id = ${submissionId}
      AND category = ${CLASSROOM_SOLUTION_POINTS_CATEGORY}
    LIMIT 1
  `) as { id: number; status?: string }[]
  if (existing.length > 0) {
    return {
      success: false,
      message: `You have already submitted for this assignment. Status: ${existing[0].status || "pending"}.`,
      error: "duplicate",
    }
  }

  const timingBooster = resolveClassroomSubmissionBooster({
    submissionId,
    openedAt: assignment.created_at ?? null,
    deadline: assignment.deadline ?? null,
    submittedAt: new Date(),
  })
  const finalPoints = clampClassroomPointsForDb(CLASSROOM_BASE_POINTS * timingBooster)
  const truncatedReason = (assignment.title || "Solution submission").slice(0, 500)
  const instructorId = await resolveClassroomAwardInstructorId({
    studentDbId: student.id,
    assignmentCreatedBy: Number(assignment.created_by) || null,
  })

  try {
    await sql`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS submitted_via_codebench BOOLEAN DEFAULT false`
  } catch {
    /* optional column */
  }

  const pointResult = (await sql`
    INSERT INTO classroom_points (
      student_id,
      points,
      reason,
      category,
      awarded_by,
      session,
      status,
      submission_id,
      point_booster,
      submitted_via_codebench
    ) VALUES (
      ${student.id},
      ${finalPoints},
      ${truncatedReason},
      ${CLASSROOM_SOLUTION_POINTS_CATEGORY},
      ${instructorId},
      ${student.section},
      'pending',
      ${submissionId},
      ${timingBooster},
      false
    )
    RETURNING id
  `) as { id: number }[]

  const classroomPointId = pointResult[0]?.id ?? 0

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS classroom_solution_submissions (
        id SERIAL PRIMARY KEY,
        classroom_point_id INTEGER NOT NULL,
        student_id INTEGER NOT NULL,
        submission_id INTEGER NOT NULL,
        answer_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  } catch {
    /* table may already exist */
  }

  await sql`
    INSERT INTO classroom_solution_submissions (
      classroom_point_id,
      student_id,
      submission_id,
      answer_json
    ) VALUES (
      ${classroomPointId},
      ${student.id},
      ${submissionId},
      ${answerForStore}::jsonb
    )
  `

  let aiResult: Awaited<ReturnType<typeof autoEvaluateClassroomSolutionSubmission>> | null = null
  if (questionConfig) {
    try {
      aiResult = await autoEvaluateClassroomSolutionSubmission({
        classroomPointId,
        studentDbId: student.id,
        timingBooster,
        baseReason: truncatedReason,
        studentAnswer: JSON.parse(answerForStore),
        questionConfig,
      })
    } catch (aiError) {
      console.error("[student capability] classroom points auto-evaluate failed:", aiError)
    }
  }

  return {
    success: true,
    message: aiResult?.autoApproved
      ? "Solution submitted - provisional points recorded."
      : aiResult?.aiGraded
        ? "Solution submitted - provisional AI feedback recorded."
        : "Solution submitted successfully for grading.",
    entity: {
      type: "classroom_point",
      id: classroomPointId,
      title: assignment.title,
      route: "/module/classroom-points",
    },
    data: {
      status: aiResult?.status ?? "pending",
      pointBooster: timingBooster,
      pointsAwarded: aiResult?.pointsAwarded ?? finalPoints,
      boosterLabel: timingBoosterLabel(timingBooster),
      aiGraded: aiResult?.aiGraded ?? false,
      autoApproved: aiResult?.autoApproved ?? false,
      instructorFeedback: aiResult?.instructorFeedback ?? null,
      aiFeedback: aiResult?.aiFeedback ?? null,
      requiresManualReview: aiResult?.requiresManualReview ?? true,
    },
  }
}

async function handleRecommendationCreate(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const courseId = positiveInt(ctx.args.courseId ?? ctx.args.course_id)
  const instructorId = positiveInt(ctx.args.instructorId ?? ctx.args.instructor_id)
  const purposeRaw = textValue(ctx.args.purpose)
  const purpose = purposeRaw.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if (!courseId || !instructorId) {
    return { success: false, message: "courseId and instructorId are required.", error: "invalid_args" }
  }
  if (!(RECOMMENDATION_PURPOSES as readonly string[]).includes(purpose)) {
    return { success: false, message: "Invalid purpose.", error: "invalid_args" }
  }

  const deadlineStr = ctx.args.deadline ? textValue(ctx.args.deadline) : null
  const recipientName = ctx.args.recipientName != null ? textValue(ctx.args.recipientName) : null
  const recipientOrganization = ctx.args.recipientOrganization != null ? textValue(ctx.args.recipientOrganization) : null
  const letterIsSpecific = Boolean(ctx.args.letterIsSpecific ?? ctx.args.letter_is_specific)
  const recipientAddressRaw =
    ctx.args.recipientAddress != null || ctx.args.recipient_address != null
      ? textValue(ctx.args.recipientAddress ?? ctx.args.recipient_address)
      : ""
  const recipientAddress = letterIsSpecific && recipientAddressRaw ? recipientAddressRaw : null
  const studentRequestDescription =
    ctx.args.studentRequestDescription != null || ctx.args.student_request_description != null
      ? textValue(ctx.args.studentRequestDescription ?? ctx.args.student_request_description)
      : null
  if (studentRequestDescription !== null && studentRequestDescription.length === 0) {
    return { success: false, message: "Description cannot be only whitespace.", error: "invalid_args" }
  }

  await ensureInstructorRecommendationSettings(instructorId)
  const settingsRows = (await sql`
    SELECT *
    FROM recommendation_settings
    WHERE instructor_id = ${instructorId}
    LIMIT 1
  `) as { enabled: boolean; max_requests_per_semester: number; minimum_notice_days: number; require_purpose_deadline: boolean }[]
  const settings = settingsRows[0]
  if (!settings?.enabled) {
    return { success: false, message: "This instructor is not accepting recommendation requests right now.", error: "forbidden" }
  }

  if (settings.require_purpose_deadline && !deadlineStr) {
    return { success: false, message: "Deadline is required.", error: "invalid_args" }
  }

  let deadline: string | null = null
  if (deadlineStr) {
    const d = new Date(deadlineStr)
    if (Number.isNaN(d.getTime())) {
      return { success: false, message: "Invalid deadline.", error: "invalid_args" }
    }
    deadline = d.toISOString().slice(0, 10)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const noticeMs = Math.max(0, Number(settings.minimum_notice_days) || 0) * 86400000
    if (d.getTime() < today.getTime() + noticeMs) {
      return {
        success: false,
        message: `Deadline must be at least ${settings.minimum_notice_days} day(s) from today.`,
        error: "validation_failed",
      }
    }
  }

  const semesterKey = (await getActiveSemesterKey()) ?? "unknown"
  const usedRows = (await sql`
    SELECT COUNT(*)::int AS c
    FROM recommendation_requests
    WHERE student_id = ${studentDbId}
      AND semester_key = ${semesterKey}
  `) as { c: number }[]
  const count = Number(usedRows[0]?.c ?? 0)
  if (count >= (settings.max_requests_per_semester ?? 3)) {
    return {
      success: false,
      message: "You have reached the maximum recommendation requests for this term.",
      error: "forbidden",
    }
  }

  let purposeOtherDetail: string | null = null
  if (purpose === "other") {
    const detail = textValue(ctx.args.purposeOtherDetail ?? ctx.args.purpose_other_detail).slice(0, 500)
    if (detail.length < 2) {
      return {
        success: false,
        message:
          'When purpose is "Other", add a short phrase (2+ characters) for the formal letter.',
        error: "invalid_args",
      }
    }
    purposeOtherDetail = detail
  }

  const requestRows = (await sql`
    INSERT INTO recommendation_requests (
      student_id, instructor_id, course_id, purpose, purpose_other_detail,
      recipient_name, recipient_organization, recipient_address,
      deadline, letter_is_specific, status, semester_key, student_request_description
    ) VALUES (
      ${studentDbId}, ${instructorId}, ${courseId}, ${purpose}, ${purposeOtherDetail},
      ${recipientName}, ${recipientOrganization}, ${recipientAddress},
      ${deadline}, ${letterIsSpecific}, 'requested', ${semesterKey}, ${studentRequestDescription}
    )
    RETURNING id
  `) as { id: number }[]
  const requestId = requestRows[0]?.id ?? 0

  await logRecommendationAudit({
    requestId,
    actorType: "student",
    actorId: studentDbId,
    action: "request_created",
    details: { purpose, courseId, instructorId },
  })

  await notifyRecommendationStudent(requestId, "created").catch(() => {})
  await notifyRecommendationInstructor(requestId, "new_request").catch(() => {})

  return {
    success: true,
    message: "Recommendation request created.",
    entity: {
      type: "recommendation_request",
      id: requestId,
      title: `Recommendation request #${requestId}`,
      route: `/student/dashboard-v2/recommendations/${requestId}`,
    },
  }
}

async function handleRecommendationCancel(ctx: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  const studentDbId = studentId(ctx)
  const requestId = positiveInt(ctx.args.requestId ?? ctx.args.id)
  if (!requestId) {
    return { success: false, message: "requestId is required.", error: "invalid_args" }
  }

  const reqRows = (await sql`
    SELECT r.*,
      sess.code AS course_code,
      i.name AS instructor_name,
      s.full_name AS student_full_name
    FROM recommendation_requests r
    JOIN sessions sess ON sess.id = r.course_id
    JOIN instructors i ON i.id = r.instructor_id
    JOIN students s ON s.id = r.student_id
    WHERE r.id = ${requestId}
      AND r.student_id = ${studentDbId}
    LIMIT 1
  `) as { id: number; status: string }[]
  if (reqRows.length === 0) {
    return { success: false, message: "Recommendation request not found.", error: "not_found" }
  }

  const st = String(reqRows[0].status)
  const draftCountRows = (await sql`
    SELECT COUNT(*)::int AS c
    FROM recommendation_drafts
    WHERE request_id = ${requestId}
  `) as { c: number }[]
  const draftCount = Number(draftCountRows[0]?.c ?? 0)
  const canWithdraw = st === "requested" || st === "info_requested" || (st === "approved" && draftCount === 0)
  if (!canWithdraw) {
    return {
      success: false,
      message: "This request can't be withdrawn anymore. Contact your instructor if you need to cancel.",
      error: "forbidden",
    }
  }

  await logRecommendationAudit({
    requestId,
    actorType: "student",
    actorId: studentDbId,
    action: "withdrawn",
    details: { previousStatus: st },
  })
  await notifyRecommendationInstructor(requestId, "student_withdrew", { previousStatus: st }).catch(() => {})

  const deleted = (await sql`
    DELETE FROM recommendation_requests
    WHERE id = ${requestId}
      AND student_id = ${studentDbId}
    RETURNING id
  `) as { id: number }[]
  if (deleted.length === 0) {
    return { success: false, message: "Failed to withdraw request.", error: "write_failed" }
  }

  return {
    success: true,
    message: "Recommendation request withdrawn.",
    entity: {
      type: "recommendation_request",
      id: requestId,
      title: `Recommendation request #${requestId}`,
      route: "/module/recommendations",
    },
  }
}

async function handleTradeCenterUnsupported(_: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  return unsupported("Open Trade Center in the app to create or submit this item.")
}

async function handleCodebenchUnsupported(_: CapabilityExecutionContext): Promise<CapabilityHandlerResult> {
  return unsupported("Open CodeBench in the app to save or update code.")
}

registerCapabilityHandlers("student", {
  "groups.create": handleGroupCreate,
  "groups.join": handleGroupJoin,
  "groups.leave": handleGroupLeave,
  // Registry id is projects.submit (student submits a project for approval)
  "projects.submit": handleProjectCreate,
  "projects.create": handleProjectCreate,
  "projects.update": handleProjectUpdate,
  "classroom-points.submit": handleClassroomPointsSubmit,
  "recommendations.create": handleRecommendationCreate,
  "recommendations.submit": handleRecommendationCreate,
  "recommendations.cancel": handleRecommendationCancel,
  "trade-center.create": handleTradeCenterUnsupported,
  "trade-center.submit": handleTradeCenterUnsupported,
  "codebench.create": handleCodebenchUnsupported,
  "codebench.update": handleCodebenchUnsupported,
})

export {
  handleClassroomPointsSubmit,
  handleGroupCreate,
  handleGroupJoin,
  handleGroupLeave,
  handleProjectCreate,
  handleProjectUpdate,
  handleRecommendationCancel,
  handleRecommendationCreate,
}
