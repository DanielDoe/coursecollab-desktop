import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    const section = searchParams.get("section")
    const sectionRows = section && section !== "all" ? normalizedSectionVariantsForSql(section) : []

    let results

    if (quizId && quizId !== "all" && section && section !== "all") {
      // Both filters
      results = await sql`
        SELECT 
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / qa.total_questions::numeric) * 100) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.quiz_id = ${Number.parseInt(quizId)}
          AND (
            TRIM(s.section) = ANY(${sectionRows}::text[])
            OR EXISTS (
              SELECT 1 FROM sessions sess
              WHERE sess.id = s.session_id
              AND TRIM(sess.code) = ANY(${sectionRows}::text[])
            )
          )
        ORDER BY s.section, s.student_id, qa.completed_at DESC
      `
    } else if (quizId && quizId !== "all") {
      // Quiz filter only
      results = await sql`
        SELECT 
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / qa.total_questions::numeric) * 100) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.quiz_id = ${Number.parseInt(quizId)}
        ORDER BY s.section, s.student_id, qa.completed_at DESC
      `
    } else if (section && section !== "all") {
      // Section filter only
      results = await sql`
        SELECT 
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / qa.total_questions::numeric) * 100) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE (
          TRIM(s.section) = ANY(${sectionRows}::text[])
          OR EXISTS (
            SELECT 1 FROM sessions sess
            WHERE sess.id = s.session_id
            AND TRIM(sess.code) = ANY(${sectionRows}::text[])
          )
        )
        ORDER BY s.section, s.student_id, qa.completed_at DESC
      `
    } else {
      // No filters
      results = await sql`
        SELECT 
          s.full_name as student_name,
          s.student_id,
          s.section,
          q.title as quiz_title,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / qa.total_questions::numeric) * 100) as percentage,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        ORDER BY s.section, s.student_id, qa.completed_at DESC
      `
    }

    // Generate CSV
    const headers = [
      "Student Name",
      "Student ID",
      "Section",
      "Quiz Title",
      "Score",
      "Total Questions",
      "Percentage",
      "Completed At",
    ]

    const csvRows = [headers.join(",")]

    for (const result of results) {
      const row = [
        `"${result.student_name}"`,
        result.student_id,
        result.section,
        `"${result.quiz_title}"`,
        result.score,
        result.total_questions,
        result.percentage,
        new Date(result.completed_at).toISOString(),
      ]
      csvRows.push(row.join(","))
    }

    const csv = csvRows.join("\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="quiz-results-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to export results:", error)
    return NextResponse.json({ error: "Failed to export results" }, { status: 500 })
  }
}
