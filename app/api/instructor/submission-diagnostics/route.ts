import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import {
  ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL,
  ANSWER_SUBMISSION_ISSUE_ERROR_TYPE_SQL,
} from "@/lib/quiz-answer-data-sql"
import { sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"

function classifyIssue(
  answerData: unknown,
  requiresReview: boolean | null,
): { errorType: string; issueKind: "submission_failed" | "requires_review" } {
  const ad =
    answerData && typeof answerData === "object"
      ? (answerData as Record<string, unknown>)
      : typeof answerData === "string"
        ? (() => {
            try {
              return JSON.parse(answerData) as Record<string, unknown>
            } catch {
              return null
            }
          })()
        : null

  const submissionFailed =
    ad?.submissionFailed === true ||
    ad?.submissionFailed === "true" ||
    String(ad?.submissionFailed ?? "").toLowerCase() === "true"

  if (submissionFailed) {
    return {
      errorType: String(ad?.submission_error_type ?? "Submission failed"),
      issueKind: "submission_failed",
    }
  }
  if (requiresReview) {
    return { errorType: "Requires manual review", issueKind: "requires_review" }
  }
  return { errorType: "Unknown", issueKind: "requires_review" }
}

/**
 * GET /api/instructor/submission-diagnostics
 *
 * Course-scoped diagnostics for submission failures (network/timeout saves) and answers
 * flagged for manual review. Requires x-instructor-id and x-course-id headers.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "7", 10)))
    const courseId = scope.course.id
    const courseOwnerId = Number(scope.course.instructor_id)
    const instructorId = scope.instructorId
    const actor = await loadInstructorActor(instructorId)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const failedSubmissions = await sql`
      SELECT
        qa.id as answer_id,
        qa.attempt_id,
        qa.question_id,
        qa.answered_at,
        qa.answer_data,
        qa.requires_review,
        qat.student_id,
        s.full_name as student_name,
        s.student_id as student_id_display,
        q.title as quiz_title,
        q.assessment_type,
        q.id as quiz_id
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN students s ON s.id = qat.student_id
      WHERE ${sql.unsafe(ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL)}
        AND qa.answered_at >= NOW() - (${days} || ' days')::interval
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
      ORDER BY qa.answered_at DESC
      LIMIT 200
    `

    const byErrorType = await sql`
      SELECT
        ${sql.unsafe(ANSWER_SUBMISSION_ISSUE_ERROR_TYPE_SQL)} as error_type,
        COUNT(*)::int as count
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN quizzes q ON q.id = qat.quiz_id
      WHERE ${sql.unsafe(ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL)}
        AND qa.answered_at >= NOW() - (${days} || ' days')::interval
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
      GROUP BY 1
      ORDER BY count DESC
    `

    const byAssessment = await sql`
      SELECT
        COALESCE(q.assessment_type, 'quiz') as assessment_type,
        COUNT(*)::int as count
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN quizzes q ON q.id = qat.quiz_id
      WHERE ${sql.unsafe(ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL)}
        AND qa.answered_at >= NOW() - (${days} || ' days')::interval
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
      GROUP BY COALESCE(q.assessment_type, 'quiz')
      ORDER BY count DESC
    `

    const byStudent = await sql`
      SELECT
        qat.student_id,
        s.full_name as student_name,
        s.student_id as student_id_display,
        COUNT(*)::int as issue_count
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN students s ON s.id = qat.student_id
      WHERE ${sql.unsafe(ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL)}
        AND qa.answered_at >= NOW() - (${days} || ' days')::interval
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
      GROUP BY qat.student_id, s.full_name, s.student_id
      ORDER BY issue_count DESC
      LIMIT 20
    `

    const totalRows = await sql`
      SELECT COUNT(*)::int as c
      FROM quiz_answers qa
      JOIN quiz_attempts qat ON qat.id = qa.attempt_id
      JOIN quizzes q ON q.id = qat.quiz_id
      WHERE ${sql.unsafe(ANSWER_REQUIRES_REVIEW_OR_SUBMISSION_FAILED_SQL)}
        AND qa.answered_at >= NOW() - (${days} || ' days')::interval
        AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
    `
    const totalCount = Number(totalRows[0]?.c ?? 0)

    const items = failedSubmissions.map((r: Record<string, unknown>) => {
      const classified = classifyIssue(r.answer_data, r.requires_review as boolean | null)
      const ad = r.answer_data as Record<string, unknown> | null
      return {
        answerId: r.answer_id,
        attemptId: r.attempt_id,
        questionId: r.question_id,
        answeredAt: r.answered_at,
        studentId: r.student_id,
        studentName: r.student_name,
        studentIdDisplay: r.student_id_display,
        quizTitle: r.quiz_title,
        assessmentType: r.assessment_type,
        quizId: r.quiz_id,
        requiresReview: r.requires_review,
        errorType: classified.errorType,
        issueKind: classified.issueKind,
        retryCount: ad?.submission_retry_count ?? null,
      }
    })

    return NextResponse.json({
      summary: {
        totalIssues: totalCount,
        days,
        courseId,
        courseCode: scope.course.course_code,
      },
      byErrorType: byErrorType.map((r: { error_type: string; count: number }) => ({
        errorType: r.error_type,
        count: Number(r.count),
      })),
      byAssessment: byAssessment.map((r: { assessment_type: string; count: number }) => ({
        assessmentType: r.assessment_type,
        count: Number(r.count),
      })),
      byStudent: byStudent.map((r: Record<string, unknown>) => ({
        studentId: r.student_id,
        studentName: r.student_name,
        studentIdDisplay: r.student_id_display,
        issueCount: Number(r.issue_count),
      })),
      recentItems: items,
    })
  } catch (error) {
    console.error("[Submission Diagnostics] Error:", error)
    return NextResponse.json({ error: "Failed to fetch submission diagnostics" }, { status: 500 })
  }
}
