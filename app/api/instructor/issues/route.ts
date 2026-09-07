import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scopeMeta = await resolveOptionalCourseScope(request)
    if (!scopeMeta.ok) return scopeMeta.response

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status") || "open"
    const assessmentId = searchParams.get("assessmentId")
    const assessmentType = searchParams.get("assessmentType") || searchParams.get("assessment_type")

    const courseId = scopeMeta.courseId
    const instructorId = scopeMeta.instructorId

    const typed = assessmentType != null ? String(assessmentType).trim() : ""
    const hasType = typed.length > 0
    const idNum =
      assessmentId != null && String(assessmentId).trim() !== ""
        ? parseInt(String(assessmentId), 10)
        : NaN
    const hasAssessmentId = Number.isFinite(idNum)

    let issues

    if (courseId != null && instructorId != null) {
      const courseOwnerRows = await sql`
        SELECT instructor_id FROM courses WHERE id = ${courseId} LIMIT 1
      `
      const courseOwnerId = Number(courseOwnerRows[0]?.instructor_id ?? instructorId)
      const actor = await loadInstructorActor(instructorId)
      if (!actor) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }

      if (hasAssessmentId && hasType) {
        if (typed === "quiz") {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
            WHERE qi.status = ${status}
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
              AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
              AND (
                qi.assessment_type = ${typed}
                OR qi.assessment_type IS NULL
              )
            ORDER BY qi.created_at DESC
          `
        } else {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
            WHERE qi.status = ${status}
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
              AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
              AND qi.assessment_type = ${typed}
            ORDER BY qi.created_at DESC
          `
        }
      } else if (hasType) {
        if (typed === "quiz") {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
            WHERE qi.status = ${status}
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
              AND (
                qi.assessment_type = ${typed}
                OR qi.assessment_type IS NULL
              )
            ORDER BY qi.created_at DESC
          `
        } else {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
            WHERE qi.status = ${status}
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
              AND qi.assessment_type = ${typed}
            ORDER BY qi.created_at DESC
          `
        }
      } else if (hasAssessmentId) {
        issues = await sql`
          SELECT
            qi.id,
            COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
            qi.assessment_type,
            qi.quiz_title,
            qi.question_number,
            qi.description,
            qi.status,
            qi.reporter_name as student_name,
            qi.reporter_id as student_email,
            qi.created_at,
            (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
          FROM quiz_issues qi
          INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
          WHERE qi.status = ${status}
            AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
            AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
          ORDER BY qi.created_at DESC
        `
      } else {
        issues = await sql`
          SELECT
            qi.id,
            COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
            qi.assessment_type,
            qi.quiz_title,
            qi.question_number,
            qi.description,
            qi.status,
            qi.reporter_name as student_name,
            qi.reporter_id as student_email,
            qi.created_at,
            (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
          FROM quiz_issues qi
          INNER JOIN quizzes q ON q.id = COALESCE(qi.assessment_id, qi.quiz_id)
          WHERE qi.status = ${status}
            AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, courseId)}
          ORDER BY qi.created_at DESC
        `
      }
    } else {
      const instructorSession =
        request.headers.get("authorization") || request.headers.get("x-instructor-id")

      if (!instructorSession) {
        return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
      }

      if (hasAssessmentId && hasType) {
        if (typed === "quiz") {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            WHERE qi.status = ${status}
              AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
              AND (
                qi.assessment_type = ${typed}
                OR qi.assessment_type IS NULL
              )
            ORDER BY qi.created_at DESC
          `
        } else {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            WHERE qi.status = ${status}
              AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
              AND qi.assessment_type = ${typed}
            ORDER BY qi.created_at DESC
          `
        }
      } else if (hasType) {
        if (typed === "quiz") {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            WHERE qi.status = ${status}
              AND (
                qi.assessment_type = ${typed}
                OR qi.assessment_type IS NULL
              )
            ORDER BY qi.created_at DESC
          `
        } else {
          issues = await sql`
            SELECT
              qi.id,
              COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
              qi.assessment_type,
              qi.quiz_title,
              qi.question_number,
              qi.description,
              qi.status,
              qi.reporter_name as student_name,
              qi.reporter_id as student_email,
              qi.created_at,
              (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
            FROM quiz_issues qi
            WHERE qi.status = ${status}
              AND qi.assessment_type = ${typed}
            ORDER BY qi.created_at DESC
          `
        }
      } else if (hasAssessmentId) {
        issues = await sql`
          SELECT
            qi.id,
            COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
            qi.assessment_type,
            qi.quiz_title,
            qi.question_number,
            qi.description,
            qi.status,
            qi.reporter_name as student_name,
            qi.reporter_id as student_email,
            qi.created_at,
            (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
          FROM quiz_issues qi
          WHERE qi.status = ${status}
            AND (qi.assessment_id = ${idNum} OR qi.quiz_id = ${idNum})
          ORDER BY qi.created_at DESC
        `
      } else {
        issues = await sql`
          SELECT
            qi.id,
            COALESCE(qi.assessment_id, qi.quiz_id) as quiz_id,
            qi.assessment_type,
            qi.quiz_title,
            qi.question_number,
            qi.description,
            qi.status,
            qi.reporter_name as student_name,
            qi.reporter_id as student_email,
            qi.created_at,
            (SELECT COUNT(*) FROM quiz_issue_comments WHERE issue_id = qi.id) as comment_count
          FROM quiz_issues qi
          WHERE qi.status = ${status}
          ORDER BY qi.created_at DESC
        `
      }
    }

    return NextResponse.json({ issues })
  } catch (error) {
    console.error("Failed to fetch issues:", error)
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 })
  }
}
