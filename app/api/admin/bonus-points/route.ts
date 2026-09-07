import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { quizId, section, confirm } = await request.json()

    if (!confirm) {
      return NextResponse.json({ error: "Confirmation required" }, { status: 400 })
    }

    console.log("[v0] Bonus points operation started", {
      quizId,
      section,
      quizIdType: typeof quizId,
      sectionType: typeof section,
    })

    const parsedQuizId = quizId && quizId !== "" && quizId !== "all" ? Number.parseInt(quizId, 10) : null
    console.log("[v0] Parsed quizId:", parsedQuizId, "isNaN:", isNaN(parsedQuizId || 0))

    const sectionVariants =
      section && section !== "" && section !== "all" ? normalizedSectionVariantsForSql(section) : []

    const nullAnswers = await sql`
      SELECT 
        qa.id as answer_id,
        qat.id as attempt_id,
        qq.id as question_id,
        qat.student_id,
        s.full_name as student_name,
        s.section,
        qat.quiz_id,
        q.title as quiz_title,
        qq.question_text,
        qq.question_order
      FROM quiz_attempts qat
      JOIN students s ON s.id = qat.student_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN quiz_questions qq ON qq.quiz_id = q.id
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = qat.id
      WHERE (
        qa.id IS NULL 
        OR (qa.selected_answer IS NULL AND qa.is_correct = false)
        OR (qa.selected_answer = '' AND qa.is_correct = false)
        OR (qa.selected_answer = 'null' AND qa.is_correct = false)
      )
      AND (qa.selected_answer IS NULL OR qa.selected_answer != 'BONUS')
      ${parsedQuizId && !isNaN(parsedQuizId) ? sql`AND qat.quiz_id = ${parsedQuizId}` : sql``}
      ${sectionVariants.length > 0
        ? sql`AND (
            TRIM(s.section) = ANY(${sectionVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
            )
          )`
        : sql``}
      ORDER BY qat.quiz_id, s.section, s.full_name, qq.question_order
    `

    console.log(`[v0] Found ${nullAnswers.length} null/skipped answers to process`)

    if (nullAnswers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No null/skipped answers found to grant bonus points",
        affectedStudents: 0,
        affectedAnswers: 0,
      })
    }

    // Log sample of what we're about to update
    console.log(
      "[v0] Sample answers to be updated:",
      nullAnswers.slice(0, 5).map((a: any) => ({
        answerId: a.answer_id,
        attemptId: a.attempt_id,
        questionId: a.question_id,
        studentName: a.student_name,
        quizTitle: a.quiz_title,
        questionText: a.question_text?.substring(0, 50) + "...",
        hasAnswerRow: a.answer_id !== null,
      })),
    )

    const existingAnswers = nullAnswers.filter((a: any) => a.answer_id !== null)
    const missingAnswers = nullAnswers.filter((a: any) => a.answer_id === null)

    console.log(`[v0] Existing answers to update: ${existingAnswers.length}`)
    console.log(`[v0] Missing answers to create: ${missingAnswers.length}`)

    if (existingAnswers.length > 0) {
      const answerIds = existingAnswers.map((a: any) => a.answer_id)
      const updateResult = await sql`
        UPDATE quiz_answers
        SET is_correct = true,
            selected_answer = 'BONUS',
            answered_at = NOW()
        WHERE id = ANY(${answerIds})
      `
      console.log(`[v0] Updated ${existingAnswers.length} existing answers in single query`)
    }

    if (missingAnswers.length > 0) {
      const attemptIds = missingAnswers.map((a: any) => a.attempt_id)
      const questionIds = missingAnswers.map((a: any) => a.question_id)

      console.log(`[v0] Preparing to insert ${missingAnswers.length} new rows`)
      console.log(`[v0] Sample data - attemptIds:`, attemptIds.slice(0, 3), "questionIds:", questionIds.slice(0, 3))

      const insertResult = await sql`
        INSERT INTO quiz_answers (attempt_id, question_id, selected_answer, is_correct, answered_at)
        SELECT 
          unnest(${attemptIds}::int[]) as attempt_id,
          unnest(${questionIds}::int[]) as question_id,
          'BONUS' as selected_answer,
          true as is_correct,
          NOW() as answered_at
      `

      console.log(`[v0] Created ${missingAnswers.length} new answer rows in single INSERT query`)
    }

    const uniqueAttempts = [...new Set(nullAnswers.map((a: any) => a.attempt_id))]

    console.log(`[v0] Recalculating scores for ${uniqueAttempts.length} attempts in single query`)

    const scoreUpdateResult = await sql`
      UPDATE quiz_attempts qat
      SET score = (
        SELECT COUNT(*) FILTER (WHERE is_correct = true)
        FROM quiz_answers
        WHERE attempt_id = qat.id
      )
      WHERE qat.id = ANY(${uniqueAttempts})
    `

    console.log("[v0] Bonus points operation completed successfully")
    console.log(
      `[v0] Total database queries executed: ${existingAnswers.length > 0 ? 1 : 0} UPDATE + ${missingAnswers.length > 0 ? 1 : 0} INSERT + 1 score recalculation = ${(existingAnswers.length > 0 ? 1 : 0) + (missingAnswers.length > 0 ? 1 : 0) + 1} queries`,
    )

    // Group by student for summary
    const studentSummary = nullAnswers.reduce((acc: any, answer: any) => {
      const key = `${answer.student_id}-${answer.quiz_id}`
      if (!acc[key]) {
        acc[key] = {
          studentId: answer.student_id,
          studentName: answer.student_name,
          section: answer.section,
          quizTitle: answer.quiz_title,
          bonusPoints: 0,
        }
      }
      acc[key].bonusPoints++
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      message: "Bonus points granted successfully",
      affectedStudents: uniqueAttempts.length,
      affectedAnswers: nullAnswers.length,
      summary: Object.values(studentSummary),
    })
  } catch (error) {
    console.error("[v0] Bonus points operation error:", error)
    console.error("[v0] Error stack:", error instanceof Error ? error.stack : "No stack trace")
    return NextResponse.json(
      { error: "Failed to grant bonus points", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}

// GET endpoint to preview what would be affected
export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const section = searchParams.get("section")

    console.log("[v0] Bonus preview request:", {
      quizId,
      section,
      quizIdType: typeof quizId,
      sectionType: typeof section,
      quizIdValue: quizId,
      sectionValue: section,
    })

    const parsedQuizId = quizId && quizId !== "" && quizId !== "all" ? Number.parseInt(quizId, 10) : null
    console.log("[v0] Parsed quizId:", parsedQuizId, "isValid:", parsedQuizId !== null && !isNaN(parsedQuizId))

    const validSection = section && section !== "" && section !== "all" ? section : null
    const previewSectionVariants = validSection ? normalizedSectionVariantsForSql(validSection) : []
    console.log("[v0] Valid section:", validSection)

    if (parsedQuizId === 13 && validSection === "P02") {
      console.log("[v0] DEBUG: Checking actual data for Quiz 13, Section P02")

      const debugAttempts = await sql`
        SELECT qat.id, qat.student_id, s.full_name, s.section, qat.quiz_id
        FROM quiz_attempts qat
        JOIN students s ON s.id = qat.student_id
        WHERE qat.quiz_id = 13 AND s.section = 'P02'
        LIMIT 5
      `
      console.log("[v0] DEBUG: Found attempts:", debugAttempts)

      if (debugAttempts.length > 0) {
        const attemptId = debugAttempts[0].id
        const debugAnswers = await sql`
          SELECT 
            qa.id,
            qa.attempt_id,
            qa.question_id,
            qa.selected_answer,
            qa.is_correct,
            LENGTH(qa.selected_answer) as answer_length,
            qa.selected_answer IS NULL as is_null,
            qa.selected_answer = '' as is_empty_string,
            qa.selected_answer = 'null' as is_string_null
          FROM quiz_answers qa
          WHERE qa.attempt_id = ${attemptId}
          ORDER BY qa.question_id
          LIMIT 10
        `
        console.log("[v0] DEBUG: Sample answers for attempt", attemptId, ":", debugAnswers)

        const debugQuestions = await sql`
          SELECT 
            qq.id as question_id,
            qq.question_order,
            qq.question_text,
            qa.id as answer_id,
            qa.selected_answer,
            qa.is_correct
          FROM quiz_questions qq
          LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${attemptId}
          WHERE qq.quiz_id = 13
          ORDER BY qq.question_order
          LIMIT 10
        `
        console.log("[v0] DEBUG: Questions with answers for attempt", attemptId, ":", debugQuestions)
      }
    }

    console.log("[v0] Executing preview query with filters:", {
      hasQuizFilter: parsedQuizId !== null && !isNaN(parsedQuizId),
      hasSectionFilter: validSection !== null,
    })

    const preview = await sql`
      SELECT 
        COUNT(DISTINCT qat.id) as affected_attempts,
        COUNT(*) as affected_answers,
        COUNT(DISTINCT qat.student_id) as affected_students,
        COUNT(DISTINCT qat.quiz_id) as affected_quizzes
      FROM quiz_attempts qat
      JOIN students s ON s.id = qat.student_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN quiz_questions qq ON qq.quiz_id = q.id
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = qat.id
      WHERE (
        qa.id IS NULL 
        OR qa.selected_answer IS NULL 
        OR qa.selected_answer = '' 
        OR qa.selected_answer = 'null'
      )
      AND (qa.is_correct = false OR qa.is_correct IS NULL OR qa.selected_answer != 'BONUS')
      ${parsedQuizId !== null && !isNaN(parsedQuizId) ? sql`AND qat.quiz_id = ${parsedQuizId}` : sql``}
      ${previewSectionVariants.length > 0
        ? sql`AND (
            TRIM(s.section) = ANY(${previewSectionVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id AND TRIM(sess.code) = ANY(${previewSectionVariants}::text[])
            )
          )`
        : sql``}
    `

    console.log("[v0] Preview query successful:", preview[0])

    const detailedBreakdown = await sql`
      SELECT 
        qat.id as attempt_id,
        qat.quiz_id,
        q.title as quiz_title,
        s.student_id,
        s.full_name as student_name,
        s.section,
        COUNT(*) as null_answers_count
      FROM quiz_attempts qat
      JOIN students s ON s.id = qat.student_id
      JOIN quizzes q ON q.id = qat.quiz_id
      JOIN quiz_questions qq ON qq.quiz_id = q.id
      LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = qat.id
      WHERE (
        qa.id IS NULL 
        OR qa.selected_answer IS NULL 
        OR qa.selected_answer = '' 
        OR qa.selected_answer = 'null'
      )
      AND (qa.is_correct = false OR qa.is_correct IS NULL OR qa.selected_answer != 'BONUS')
      ${parsedQuizId !== null && !isNaN(parsedQuizId) ? sql`AND qat.quiz_id = ${parsedQuizId}` : sql``}
      ${previewSectionVariants.length > 0
        ? sql`AND (
            TRIM(s.section) = ANY(${previewSectionVariants}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id AND TRIM(sess.code) = ANY(${previewSectionVariants}::text[])
            )
          )`
        : sql``}
      GROUP BY qat.id, qat.quiz_id, q.title, s.student_id, s.full_name, s.section
      ORDER BY q.title, s.section, s.full_name
      LIMIT 20
    `

    console.log("[v0] Sample students who would receive bonus:", detailedBreakdown)

    return NextResponse.json({
      preview: preview[0],
      sampleStudents: detailedBreakdown,
    })
  } catch (error) {
    console.error("[v0] Bonus points preview error:", error)
    console.error("[v0] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: "Failed to preview bonus points", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
