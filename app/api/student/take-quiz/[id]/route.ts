import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { NextResponse } from "next/server"
import { isBetaUser } from "@/lib/membership"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import { hasDeadlineExtensionForStudentQuiz } from "@/lib/deadline-extension"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { isPreCourseStudent } from "@/lib/student-course-access-gate"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quizId = params.id
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    console.log("[v0] Student quiz API - quizId:", quizId, "studentId:", studentId)

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    console.log("[v0] Fetching quiz from database...")
    const quizResult = await sql`
      SELECT id, title, description, time_per_question, available_from, available_until
      FROM quizzes
      WHERE id = ${quizId}
      AND (deleted_at IS NULL OR deleted_at IS NULL)
    `
    console.log("[v0] Quiz query result:", JSON.stringify(quizResult))

    if (quizResult.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizResult[0]
    console.log("[v0] Quiz object:", JSON.stringify(quiz))

    const studentDbId = await resolveStudentDatabaseIdFromParam(studentId)
    if (studentDbId == null) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (await isPreCourseStudent(studentDbId)) {
      return NextResponse.json(
        { error: "Assessments are not available until the course begins." },
        { status: 403 },
      )
    }

    // Check if student has already completed this quiz
    const existingAttempt = await sql`
      SELECT id FROM quiz_attempts
      WHERE student_id = ${studentDbId} AND quiz_id = ${quizId}
      LIMIT 1
    `
    if (existingAttempt.length > 0) {
      return NextResponse.json({ error: "You have already completed this quiz" }, { status: 403 })
    }

    const courseCtx = await resolveStudentCourseContextByDbId(studentDbId)
    const sessionId = courseCtx?.sessionId ?? null
    if (!sessionId) {
      return NextResponse.json({ error: "Student session not found" }, { status: 404 })
    }

    // Check if quiz is active for this session
    const accessResult = await sql`
      SELECT is_active
      FROM quiz_session_access
      WHERE quiz_id = ${quizId} AND session_id = ${sessionId}
      LIMIT 1
    `

    if (accessResult.length === 0 || !accessResult[0].is_active) {
      return NextResponse.json({ error: "Quiz is not active for your section" }, { status: 403 })
    }

    // Check if student is a beta user (for early access to finals)
    const isBeta = await isBetaUser(studentDbId)
    console.log(`[v0] Student ${studentId} is beta user: ${isBeta}`)

    const hasDeadlineExtension = studentDbId
      ? await hasDeadlineExtensionForStudentQuiz(studentDbId, parseInt(String(quizId), 10))
      : false
    
    // Check availability dates (skip when rollover or beta)
    const now = new Date()
    const bufferMs = 60 * 1000
    
    if (!hasDeadlineExtension && !isBeta) {
      if (quiz.available_from) {
        const availableFrom = new Date(quiz.available_from)
        if (availableFrom.getTime() > (now.getTime() + bufferMs)) {
          const ctTime = availableFrom.toLocaleString('en-US', { 
            timeZone: 'America/Chicago', 
            dateStyle: 'long', 
            timeStyle: 'short',
            hour12: true 
          })
          return NextResponse.json(
            { error: `Quiz will be available from ${ctTime} CT` },
            { status: 403 },
          )
        }
      }
      if (quiz.available_until) {
        const availableUntil = new Date(quiz.available_until)
        if (availableUntil.getTime() < (now.getTime() - bufferMs)) {
          const ctTime = availableUntil.toLocaleString('en-US', { 
            timeZone: 'America/Chicago', 
            dateStyle: 'long', 
            timeStyle: 'short',
            hour12: true 
          })
          return NextResponse.json({ 
            error: `Quiz expired on ${ctTime} CT` 
          }, { status: 403 })
        }
      }
    }

    console.log("[v0] Fetching questions from database...")
    const questions = await sql`
      SELECT 
        id, 
        question_text, 
        option_a, 
        option_b, 
        option_c, 
        option_d, 
        option_e, 
        question_order, 
        time_limit, 
        question_type, 
        bank_question_id
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
      ORDER BY question_order ASC
    `

    console.log("[v0] Found", questions.length, "questions")
    console.log("[v0] First question raw data:", JSON.stringify(questions[0]))

    console.log("[v0] Starting to map questions...")
    const cleanQuestions = questions.map((q: any, index: number) => {
      console.log(`[v0] Mapping question ${index + 1}:`, {
        id: q.id,
        type: q.question_type,
        hasText: !!q.question_text,
      })

      // SECURITY: never include answer-key fields (correct_answer, expected_answer,
      // explanation, sample_answers, MCQ is_correct flags) — this payload is sent to
      // students BEFORE they answer. Grading happens server-side on submit.
      // See lib/assessment-core/render.ts formatQuestionForRenderer.
      return {
        id: Number(q.id),
        question_text: String(q.question_text || ""),
        option_a: String(q.option_a || ""),
        option_b: String(q.option_b || ""),
        option_c: String(q.option_c || ""),
        option_d: String(q.option_d || ""),
        option_e: String(q.option_e || ""),
        question_order: Number(q.question_order || 0),
        time_limit: q.time_limit ? Number(q.time_limit) : null,
        question_type: String(q.question_type || "mcq"),
        bank_question_id: q.bank_question_id ? Number(q.bank_question_id) : null,
        hint: null,
        hint_penalty: 0.5,
      }
    })
    console.log("[v0] Finished mapping questions, total:", cleanQuestions.length)

    console.log("[v0] Constructing response object...")
    const responseData = {
      quiz: {
        id: Number(quiz.id),
        title: String(quiz.title || ""),
        description: String(quiz.description || ""),
        time_per_question: Number(quiz.time_per_question || 60),
        available_from: quiz.available_from ? String(quiz.available_from) : null,
        available_until: quiz.available_until ? String(quiz.available_until) : null,
        questions: cleanQuestions,
      },
    }
    console.log("[v0] Response object constructed, quiz has", responseData.quiz.questions.length, "questions")

    console.log("[v0] Testing JSON serialization...")
    try {
      const testString = JSON.stringify(responseData)
      console.log("[v0] JSON serialization successful, length:", testString.length)
      console.log("[v0] Response structure:", {
        hasQuiz: !!responseData.quiz,
        quizId: responseData.quiz.id,
        questionCount: responseData.quiz.questions.length,
        firstQuestionId: responseData.quiz.questions[0]?.id,
      })
    } catch (serError) {
      console.error("[v0] JSON serialization failed:", serError)
      return NextResponse.json({ error: "Failed to serialize quiz data", details: String(serError) }, { status: 500 })
    }

    console.log("[v0] About to return NextResponse.json()...")
    const response = NextResponse.json(responseData)
    console.log("[v0] NextResponse.json() created successfully")
    return response
  } catch (error) {
    console.error("[v0] Quiz API error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    console.error("[v0] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: "Failed to load quiz",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
