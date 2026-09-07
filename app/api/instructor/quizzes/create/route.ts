import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { getAssessmentPolicyForCourse } from "@/lib/assessment-policy-settings.server"
import { parseClientAvailabilityToUtcIso, utcIsoToDbTimestamp } from "@/lib/timezone"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const { instructorId, course } = scope
    const courseId = course.id

    const {
      title,
      description,
      time_per_question,
      available_from,
      available_until,
      questions,
      sendNotifications = false,
      retake_enabled = false,
      retake_limit = 0,
      retake_policy = "best",
      review_before_retake = false,
    } = await request.json()

    const availableFromUTC = utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(available_from))
    const availableUntilUTC = utcIsoToDbTimestamp(parseClientAvailabilityToUtcIso(available_until))

    const policy = await getAssessmentPolicyForCourse(courseId)
    const rt = policy.retakes
    const effectiveTimePerQuestion = time_per_question ?? policy.timer.time_per_question_default
    const effectiveRetakeEnabled = retake_enabled ?? rt.retake_enabled_default
    const effectiveRetakeLimit = retake_limit ?? rt.retake_limit_default
    const effectiveRetakePolicy = retake_policy ?? rt.retake_policy_default
    const effectiveReviewBeforeRetake = review_before_retake ?? rt.review_before_retake_default

    const quizResult = await sql`
      INSERT INTO quizzes (
        title, 
        description, 
        time_per_question, 
        created_by, 
        is_public,
        available_from,
        available_until,
        retake_enabled,
        retake_limit,
        retake_policy,
        review_before_retake,
        course_id,
        created_at,
        updated_at
      )
      VALUES (
        ${title}, 
        ${description}, 
        ${effectiveTimePerQuestion}, 
        ${instructorId}, 
        true,
        ${availableFromUTC},
        ${availableUntilUTC},
        ${effectiveRetakeEnabled},
        ${effectiveRetakeLimit === 0 ? null : effectiveRetakeLimit},
        ${effectiveRetakePolicy},
        ${effectiveReviewBeforeRetake},
        ${courseId},
        NOW(),
        NOW()
      )
      RETURNING id
    `

    const quizId = quizResult[0].id

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]

      await sql`
        INSERT INTO quiz_questions (
          quiz_id, question_text, option_a, option_b, option_c, option_d, option_e,
          correct_answer, question_order, time_limit, question_type, max_points, points, created_at
        )
        VALUES (
          ${quizId}, ${q.question_text}, ${q.option_a || null}, ${q.option_b || null}, 
          ${q.option_c || null}, ${q.option_d || null}, ${q.option_e || null},
          ${q.correct_answer}, ${i + 1}, 
          ${q.time_limit || null}, ${q.question_type || "mcq"}, 
          ${q.max_points || q.points || null}, ${q.points || q.max_points || 1}, NOW()
        )
      `
    }

    const courseSessions = await sql`
      SELECT id FROM sessions WHERE course_id = ${courseId}
    `

    for (const session of courseSessions) {
      await sql`
        INSERT INTO quiz_session_access (quiz_id, session_id, is_active, updated_at)
        VALUES (${quizId}, ${session.id}, false, CURRENT_TIMESTAMP)
        ON CONFLICT (quiz_id, session_id) DO NOTHING
      `
    }

    if (sendNotifications) {
      const students = await sql`
        SELECT id FROM students WHERE course_id = ${courseId}
      `

      const { createBulkNotifications } = await import("@/lib/create-notification")
      await createBulkNotifications(
        students.map((s) => s.id),
        {
          type: "quiz",
          title: "New Quiz Available! 📝",
          message: `A new quiz "${title}" has been published. Check it out!`,
          link: "/student/quizzes",
        },
      )
    }

    return NextResponse.json({ quizId })
  } catch (error) {
    console.error("[v0] Failed to create quiz:", error)
    return NextResponse.json({ error: "Failed to create quiz" }, { status: 500 })
  }
}
