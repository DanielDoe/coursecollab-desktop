import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { getSessionCodesForUi } from "@/lib/session-catalog"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: Request) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const { searchParams } = new URL(request.url)
    const savedOnly = searchParams.get("saved") === "true"
    const assessmentType = searchParams.get("assessment_type") || "quiz"

    let assessmentTypeColumnExists = false
    try {
      await sql`SELECT assessment_type FROM quizzes LIMIT 1`
      assessmentTypeColumnExists = true
    } catch (error) {
      console.log("[v0] assessment_type column doesn't exist yet")
    }

    let columnExists = false
    try {
      await sql`SELECT is_saved FROM quizzes LIMIT 1`
      columnExists = true
    } catch (error) {
      console.log("[v0] is_saved column doesn't exist yet, using backward compatible query")
    }

    let quizzes
    if (columnExists && assessmentTypeColumnExists) {
      quizzes = await sql`
        SELECT 
          q.id,
          q.title,
          q.description,
          q.is_public,
          q.time_per_question,
          q.created_at,
          q.is_saved,
          q.assessment_type,
          COUNT(DISTINCT qq.id) as question_count
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        WHERE q.assessment_type = ${assessmentType}
        ${savedOnly ? sql`AND q.is_saved = true` : sql``}
        GROUP BY q.id, q.title, q.description, q.is_public, q.time_per_question, q.created_at, q.is_saved, q.assessment_type
        ORDER BY q.created_at DESC
      `
    } else if (columnExists) {
      // Fallback for when assessment_type doesn't exist yet
      quizzes = await sql`
        SELECT 
          q.id,
          q.title,
          q.description,
          q.is_public,
          q.time_per_question,
          q.created_at,
          q.is_saved,
          'quiz' as assessment_type,
          COUNT(DISTINCT qq.id) as question_count
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        ${savedOnly ? sql`WHERE q.is_saved = true` : sql``}
        GROUP BY q.id, q.title, q.description, q.is_public, q.time_per_question, q.created_at, q.is_saved
        ORDER BY q.created_at DESC
      `
    } else {
      quizzes = await sql`
        SELECT 
          q.id,
          q.title,
          q.description,
          q.is_public,
          q.time_per_question,
          q.created_at,
          false as is_saved,
          'quiz' as assessment_type,
          COUNT(DISTINCT qq.id) as question_count
        FROM quizzes q
        LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
        GROUP BY q.id, q.title, q.description, q.is_public, q.time_per_question, q.created_at
        ORDER BY q.created_at DESC
      `

      if (savedOnly) {
        quizzes = []
      }
    }

    let sessionAccess = []
    try {
      sessionAccess = await sql`
        SELECT 
          qsa.quiz_id,
          s.code as session_code,
          qsa.is_active
        FROM quiz_session_access qsa
        JOIN sessions s ON qsa.session_id = s.id
      `
    } catch (error) {
      console.log("[v0] quiz_session_access table doesn't exist yet, showing all quizzes as inactive")
    }

    const sectionCodes = await getSessionCodesForUi()
    const quizzesWithAccess = quizzes.map((quiz) => {
      const access = sessionAccess.filter((sa) => sa.quiz_id === quiz.id)
      const sessionAccessMap: Record<string, boolean> = {}
      for (const code of sectionCodes) {
        sessionAccessMap[code] = access.find((a) => a.session_code === code)?.is_active || false
      }

      return {
        ...quiz,
        session_access: sessionAccessMap,
      }
    })

    return NextResponse.json({ quizzes: quizzesWithAccess })
  } catch (error) {
    console.error("[v0] Failed to fetch quizzes:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes", quizzes: [] }, { status: 500 })
  }
}
