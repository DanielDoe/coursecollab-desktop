import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"

export const dynamic = 'force-dynamic'

/**
 * POST /api/[assessmentType]/create
 * 
 * Dynamic create endpoint for all assessment types
 * Replaces old /api/assessments/create?type=... pattern
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { assessmentType: string } }
) {
  try {
    const assessmentType = params.assessmentType as AssessmentType
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      title,
      description,
      time_per_question,
      available_from,
      available_until,
      questions,
      sendNotifications = true,
      retake_enabled = false,
      retake_limit = 0,
      retake_policy = "best",
      review_before_retake = false,
      instructorId
    } = body

    if (!title || !instructorId) {
      return NextResponse.json(
        { error: "Title and instructorId are required" },
        { status: 400 }
      )
    }

    const config = getAssessmentConfig(assessmentType)

    const convertToUTC = (dateTimeLocal: string | null) => {
      if (!dateTimeLocal) return null
      const localDate = new Date(dateTimeLocal)
      return localDate.toISOString()
    }

    const availableFromUTC = convertToUTC(available_from)
    const availableUntilUTC = convertToUTC(available_until)

    // Create assessment
    const assessmentResult = await sql`
      INSERT INTO ${sql.unsafe(config.tableName)} (
        title, description, created_by, is_public, is_active,
        time_per_question, available_from, available_until,
        retake_enabled, retake_limit, retake_policy, review_before_retake,
        created_at, updated_at
      )
      VALUES (
        ${title}, ${description || null}, ${Number(instructorId)}, true, true,
        ${time_per_question || 60}, ${availableFromUTC}, ${availableUntilUTC},
        ${retake_enabled}, ${retake_limit === 0 ? null : retake_limit}, ${retake_policy},
        ${review_before_retake}, NOW(), NOW()
      )
      RETURNING id
    `

    const assessmentId = assessmentResult[0].id

    // Create questions
    if (questions && Array.isArray(questions)) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        await sql`
          INSERT INTO ${sql.unsafe(config.questionsTable)} (
            ${sql.unsafe(config.idColumn)}, question_text, option_a, option_b, option_c, option_d, option_e,
            correct_answer, question_order, time_limit, question_type, max_points, points, created_at
          )
          VALUES (
            ${assessmentId}, ${q.question_text}, ${q.option_a || null}, ${q.option_b || null}, 
            ${q.option_c || null}, ${q.option_d || null}, ${q.option_e || null},
            ${q.correct_answer}, ${i + 1}, 
            ${q.time_limit || null}, ${q.question_type || "mcq"}, 
            ${q.max_points || q.points || null}, ${q.points || q.max_points || 1}, NOW()
          )
        `
      }
    }

    // Create session access for all sessions
    const allSessions = await sql`SELECT id FROM sessions`
    for (const session of allSessions) {
      await sql`
        INSERT INTO ${sql.unsafe(config.sessionAccessTable)} (${sql.unsafe(config.idColumn)}, session_id, is_active, updated_at)
        VALUES (${assessmentId}, ${session.id}, true, CURRENT_TIMESTAMP)
        ON CONFLICT (${sql.unsafe(config.idColumn)}, session_id) DO NOTHING
      `
    }

    // Send notifications if requested
    if (sendNotifications) {
      const students = await sql`SELECT id FROM students`
      const { createBulkNotifications, sendNewAssessmentEmailsIfConfigured } = await import("@/lib/create-notification")
      const linkMap: Record<string, string> = {
        quiz: "/student/dashboard-v2/quizzes",
        homework: "/student/dashboard-v2/homework",
        midsem: "/student/dashboard-v2/mid-semester-exams",
        final: "/student/dashboard-v2/final-exams",
        practice: "/student/dashboard-v2/quizzes",
        points: "/student/dashboard-v2/classroom-points",
      }
      const link = linkMap[assessmentType] ?? `/student/dashboard-v2/quizzes`
      const typeLabel = assessmentType === "midsem" ? "mid-semester exam" : assessmentType === "points" ? "classroom points" : assessmentType
      await createBulkNotifications(
        students.map((s) => s.id),
        {
          type: assessmentType === "midsem" || assessmentType === "final" ? "exam" : assessmentType === "points" ? "code_submission" : assessmentType,
          title: `New ${typeLabel} available! 📝`,
          message: `A new ${typeLabel} "${title}" has been published. Check it out!`,
          link,
        },
      )
      const emailType = assessmentType === "quiz" ? "quiz" : assessmentType === "homework" ? "homework" : assessmentType === "midsem" ? "mid-semester" : assessmentType === "final" ? "final" : assessmentType === "points" ? "code submission" : "quiz"
      const dueStr = available_until ? new Date(available_until).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
      sendNewAssessmentEmailsIfConfigured(students.map((s) => s.id), emailType, title, dueStr)
    }

    return NextResponse.json({ id: assessmentId, success: true })
  } catch (error: any) {
    console.error(`[${params.assessmentType} Create] Error:`, error)
    return NextResponse.json(
      { error: "Failed to create assessment", details: error.message },
      { status: 500 }
    )
  }
}

