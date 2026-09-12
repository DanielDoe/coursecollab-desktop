import { NextRequest, NextResponse } from "next/server"
import { getSQL } from "@/lib/db"
import {
  CLASSROOM_SOLUTION_POINTS_CATEGORY,
  isClassroomSolutionAssignment,
  parseClassroomSolutionQuestionConfig,
} from "@/lib/classroom-solution-submission"
import {
  autoEvaluateClassroomSolutionSubmission,
} from "@/lib/classroom-points-auto-evaluate"
import { getRewardsPolicyForStudent } from "@/lib/rewards-policy.server"
import {
  CLASSROOM_BASE_POINTS,
  resolveClassroomSubmissionBooster,
  timingBoosterLabel,
} from "@/lib/classroom-point-booster"
import {
  clampClassroomPointsForDb,
  ensureClassroomPointsSchema,
} from "@/lib/ensure-classroom-points-schema"
import {
  circuitSubmissionHasRequiredUpload,
  compactCircuitSubmissionForSubmit,
  parseCircuitSubmissionAnswer,
  parseCircuitSubmissionConfig,
} from "@/lib/circuit-submission"
import { resolveClassroomAwardInstructorId } from "@/lib/classroom-points-award-instructor"

const sqlInstance = getSQL()
const BASE_POINTS = CLASSROOM_BASE_POINTS

export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { requireClassroomPointsStudent } = await import("@/lib/classroom-points-request-auth")
    const { studentAnswer, studentId, submissionId } = (await request.json()) as {
      studentAnswer?: unknown
      studentId?: string | number
      submissionId?: string | number
    }

    const studentAuth = await requireClassroomPointsStudent(request, studentId)
    if (!studentAuth.ok) return studentAuth.response

    if (studentId == null || submissionId == null || studentAnswer == null) {
      return NextResponse.json(
        { error: "studentAnswer, studentId, and submissionId are required" },
        { status: 400 },
      )
    }

    const assignmentId = Number.parseInt(String(submissionId), 10)
    if (!Number.isFinite(assignmentId)) {
      return NextResponse.json({ error: "Invalid submissionId" }, { status: 400 })
    }

    try {
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS due_at TIMESTAMP`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS submission_kind TEXT NOT NULL DEFAULT 'code'`
      await sqlInstance`ALTER TABLE classroom_point_submissions ADD COLUMN IF NOT EXISTS question_config JSONB`
    } catch {
      /* optional columns */
    }

    const assignmentRows = await sqlInstance`
      SELECT id, title, created_at, session, duration_hours, due_at, submission_kind, question_config, created_by,
        CASE
          WHEN due_at IS NOT NULL THEN due_at
          WHEN duration_hours IS NULL THEN NULL
          ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour'))
        END as expiry_time,
        COALESCE(due_at, created_at + ((COALESCE(duration_hours, 168)) * INTERVAL '1 hour')) as deadline
      FROM classroom_point_submissions
      WHERE id = ${assignmentId}
        AND (
          CASE
            WHEN due_at IS NOT NULL THEN due_at > NOW()
            WHEN duration_hours IS NULL THEN false
            ELSE (created_at + ((duration_hours + 72) * INTERVAL '1 hour')) > NOW()
          END
        )
      LIMIT 1
    `

    if (assignmentRows.length === 0) {
      return NextResponse.json({ error: "Assignment not found or expired" }, { status: 400 })
    }

    const assignment = assignmentRows[0] as {
      title: string
      created_at?: string | Date
      submission_kind?: string
      question_config?: unknown
      deadline?: string | null
      created_by?: number
    }

    if (!isClassroomSolutionAssignment(assignment.submission_kind)) {
      return NextResponse.json(
        { error: "This assignment is not a solution submission assignment" },
        { status: 400 },
      )
    }

    const questionConfig = parseClassroomSolutionQuestionConfig(assignment.question_config)
    const uploadConfig = parseCircuitSubmissionConfig(questionConfig?.solution_upload_config ?? null)

    const compactJson = compactCircuitSubmissionForSubmit(studentAnswer)
    if (!circuitSubmissionHasRequiredUpload(compactJson, uploadConfig)) {
      return NextResponse.json(
        { error: "Upload at least one file or write your solution in the workspace before submitting." },
        { status: 400 },
      )
    }

    const parsed = parseCircuitSubmissionAnswer(compactJson)
    const answerForStore = JSON.stringify({
      ...parsed,
      submission_status: "submitted",
    })

    const numericId = Number.parseInt(String(studentId), 10)
    const studentInfo =
      !Number.isNaN(numericId) && String(numericId) === String(studentId)
        ? await sqlInstance`SELECT id, section FROM students WHERE id = ${numericId}`
        : await sqlInstance`SELECT id, section FROM students WHERE student_id = ${String(studentId)}`

    if (studentInfo.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = studentInfo[0] as { id: number; section: string | null }

    const rewardsPolicy = await getRewardsPolicyForStudent(student.id)
    if (!rewardsPolicy.allow_student_submissions) {
      return NextResponse.json(
        { error: "Student submissions are disabled for this course. Contact your instructor." },
        { status: 403 },
      )
    }

    const existing = await sqlInstance`
      SELECT id, status FROM classroom_points
      WHERE student_id = ${student.id}
        AND submission_id = ${assignmentId}
        AND category = ${CLASSROOM_SOLUTION_POINTS_CATEGORY}
      LIMIT 1
    `
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `You have already submitted for this assignment. Status: ${existing[0].status || "pending"}` },
        { status: 400 },
      )
    }

    const timingBooster = resolveClassroomSubmissionBooster({
      submissionId: assignmentId,
      openedAt: assignment.created_at ?? null,
      deadline: assignment.deadline ?? null,
      submittedAt: new Date(),
    })
    await ensureClassroomPointsSchema()
    const finalPoints = clampClassroomPointsForDb(BASE_POINTS * timingBooster)
    const truncatedReason = (assignment.title || "Solution submission").slice(0, 500)
    const instructorId = await resolveClassroomAwardInstructorId({
      studentDbId: Number(student.id),
      assignmentCreatedBy: Number(assignment.created_by) || null,
    })

    try {
      await sqlInstance`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS submitted_via_codebench BOOLEAN DEFAULT false`
    } catch {
      /* ignore */
    }

    const pointResult = await sqlInstance`
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
        ${assignmentId},
        ${timingBooster},
        false
      )
      RETURNING id
    `

    const classroomPointId = pointResult[0]?.id as number

    try {
      await sqlInstance`
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
      /* table may exist */
    }

    await sqlInstance`
      INSERT INTO classroom_solution_submissions (
        classroom_point_id,
        student_id,
        submission_id,
        answer_json
      ) VALUES (
        ${classroomPointId},
        ${student.id},
        ${assignmentId},
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
        console.error("[Classroom Points Submit Solution] AI auto-evaluate failed:", aiError)
      }
    }

    return NextResponse.json({
      success: true,
      message: aiResult?.autoApproved
        ? "Solution submitted — provisional points recorded (instructor will confirm)."
        : aiResult?.aiGraded
          ? "Solution submitted — provisional AI feedback recorded for instructor review."
          : "Solution submitted successfully for grading",
      classroomPointId,
      status: aiResult?.status ?? "pending",
      pointBooster: timingBooster,
      pointsAwarded: aiResult?.pointsAwarded ?? finalPoints,
      boosterLabel: timingBoosterLabel(timingBooster),
      aiGraded: aiResult?.aiGraded ?? false,
      autoApproved: aiResult?.autoApproved ?? false,
      instructorFeedback: aiResult?.instructorFeedback ?? null,
      aiFeedback: aiResult?.aiFeedback ?? null,
      requiresManualReview: aiResult?.requiresManualReview ?? true,
    })
  } catch (error) {
    console.error("[Classroom Points Submit Solution]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit solution" },
      { status: 500 },
    )
  }
}
