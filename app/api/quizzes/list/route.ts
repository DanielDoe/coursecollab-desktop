import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = 'force-dynamic'

/**
 * GET /api/quizzes/list
 * Fetch all QUIZZES for a student or instructor (excludes homework, mid_semester, final)
 * Must filter by assessment_type so each module shows only its own type
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const instructorId = searchParams.get("instructorId")
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session")
    const status = searchParams.get("status")
    const saved = searchParams.get("saved")

    // For students: get available quizzes (single sql template - nesting causes $1 syntax errors)
    if (studentId) {
      const studentIdNum = Number(studentId)
      const sessionCode = session && session !== "all" ? session : null

      const quizzes = sessionCode
        ? await sql`
            SELECT 
              q.id,
              q.title,
              q.description,
              q.created_by,
              q.is_public,
              q.time_per_question,
              q.available_from,
              q.available_until,
              q.retake_enabled,
              q.retake_limit,
              q.retake_policy,
              q.review_before_retake,
              q.is_saved,
              q.parent_quiz_id,
              q.strict_mode_enabled,
              q.block_copy_paste,
              q.track_tab_switches,
              q.track_mouse_movement,
              q.warn_on_tab_switch,
              q.max_tab_switches,
              q.auto_submit_on_violations,
              q.created_at,
              q.updated_at,
              q.deleted_at,
              true as is_active,
              '{}'::jsonb as session_access,
              'quiz' as assessment_type,
              COUNT(DISTINCT qq.id) as question_count,
              COUNT(DISTINCT qa.id) as attempt_count,
              MAX(qa.attempt_number) as max_attempt_number,
              MAX(qa.completed_at) as last_attempt_date
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
            LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${studentIdNum}
            WHERE q.deleted_at IS NULL
            AND (q.assessment_type = 'quiz' OR q.assessment_type IS NULL)
            AND (q.available_from IS NULL OR q.available_from <= NOW())
            AND (q.available_until IS NULL OR q.available_until > NOW())
            AND EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              JOIN sessions s ON qsa.session_id = s.id
              WHERE qsa.quiz_id = q.id
              AND s.code = ${sessionCode}
              AND qsa.is_active = true
            )
            GROUP BY q.id, q.title, q.description, q.created_by, q.is_public,
              q.time_per_question, q.available_from, q.available_until, q.retake_enabled,
              q.retake_limit, q.retake_policy, q.review_before_retake, q.is_saved,
              q.parent_quiz_id, q.strict_mode_enabled, q.block_copy_paste,
              q.track_tab_switches, q.track_mouse_movement, q.warn_on_tab_switch,
              q.max_tab_switches, q.auto_submit_on_violations,
              q.created_at, q.updated_at, q.deleted_at
            ORDER BY q.available_from DESC, q.created_at DESC
          `
        : await sql`
            SELECT 
              q.id,
              q.title,
              q.description,
              q.created_by,
              q.is_public,
              q.time_per_question,
              q.available_from,
              q.available_until,
              q.retake_enabled,
              q.retake_limit,
              q.retake_policy,
              q.review_before_retake,
              q.is_saved,
              q.parent_quiz_id,
              q.strict_mode_enabled,
              q.block_copy_paste,
              q.track_tab_switches,
              q.track_mouse_movement,
              q.warn_on_tab_switch,
              q.max_tab_switches,
              q.auto_submit_on_violations,
              q.created_at,
              q.updated_at,
              q.deleted_at,
              true as is_active,
              '{}'::jsonb as session_access,
              'quiz' as assessment_type,
              COUNT(DISTINCT qq.id) as question_count,
              COUNT(DISTINCT qa.id) as attempt_count,
              MAX(qa.attempt_number) as max_attempt_number,
              MAX(qa.completed_at) as last_attempt_date
            FROM quizzes q
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
            LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.student_id = ${studentIdNum}
            WHERE q.deleted_at IS NULL
            AND (q.assessment_type = 'quiz' OR q.assessment_type IS NULL)
            AND (q.available_from IS NULL OR q.available_from <= NOW())
            AND (q.available_until IS NULL OR q.available_until > NOW())
            GROUP BY q.id, q.title, q.description, q.created_by, q.is_public,
              q.time_per_question, q.available_from, q.available_until, q.retake_enabled,
              q.retake_limit, q.retake_policy, q.review_before_retake, q.is_saved,
              q.parent_quiz_id, q.strict_mode_enabled, q.block_copy_paste,
              q.track_tab_switches, q.track_mouse_movement, q.warn_on_tab_switch,
              q.max_tab_switches, q.auto_submit_on_violations,
              q.created_at, q.updated_at, q.deleted_at
            ORDER BY q.available_from DESC, q.created_at DESC
          `
      return NextResponse.json({ quizzes })
    }

    // For instructors: get all quizzes they created
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor ID or Student ID required" }, { status: 400 })
    }

    // Build extra WHERE conditions as raw SQL (avoid nesting sql templates - causes $1 syntax errors)
    const extraWhere: string[] = []
    if (saved === "true") extraWhere.push("q.is_saved = true")
    if (status && status !== "all") {
      switch (status) {
        case "active":
          extraWhere.push("(q.available_from IS NULL OR q.available_from <= NOW()) AND (q.available_until IS NULL OR q.available_until > NOW())")
          break
        case "inactive":
          extraWhere.push("(q.available_from > NOW() OR q.available_until < NOW())")
          break
        case "scheduled":
          extraWhere.push("q.available_from > NOW()")
          break
        case "expired":
          extraWhere.push("q.available_until < NOW()")
          break
      }
    }
    const extraWhereClause = extraWhere.length ? " AND " + extraWhere.join(" AND ") : ""

    const quizzes = await sql`
      SELECT 
        q.id,
        q.title,
        q.description,
        q.created_by,
        q.is_public,
        q.time_per_question,
        q.available_from,
        q.available_until,
        q.retake_enabled,
        q.retake_limit,
        q.retake_policy,
        q.review_before_retake,
        q.is_saved,
        q.parent_quiz_id,
        q.strict_mode_enabled,
        q.block_copy_paste,
        q.track_tab_switches,
        q.track_mouse_movement,
        q.warn_on_tab_switch,
        q.max_tab_switches,
        q.auto_submit_on_violations,
        q.created_at,
        q.updated_at,
        q.deleted_at,
        COUNT(DISTINCT qq.id) as question_count,
        COUNT(DISTINCT qa.id) as total_attempts,
        AVG(qa.score) as average_score,
        CASE 
          WHEN COUNT(qa.id) > 0 THEN 
            COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) * 100.0 / COUNT(qa.id)
          ELSE 0 
        END as completion_rate
      FROM quizzes q
      LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
      LEFT JOIN quiz_attempts qa ON q.id = qa.quiz_id
      WHERE q.created_by = ${Number(instructorId)}
      AND q.deleted_at IS NULL
      AND (q.assessment_type = 'quiz' OR q.assessment_type IS NULL)
      ${sql.unsafe(extraWhereClause)}
      GROUP BY q.id, q.title, q.description, q.created_by, q.is_public,
        q.time_per_question, q.available_from, q.available_until, q.retake_enabled,
        q.retake_limit, q.retake_policy, q.review_before_retake, q.is_saved,
        q.parent_quiz_id, q.strict_mode_enabled, q.block_copy_paste,
        q.track_tab_switches, q.track_mouse_movement, q.warn_on_tab_switch,
        q.max_tab_switches, q.auto_submit_on_violations,
        q.created_at, q.updated_at, q.deleted_at
      ORDER BY q.created_at DESC
    `

    // Fetch session_access from quiz_session_access for each quiz (required for session toggles)
    const quizzesWithAccess = await Promise.all(
      (quizzes as { id: number }[]).map(async (quiz) => {
        const sessionAccess = await sql`
          SELECT s.code, qsa.is_active
          FROM quiz_session_access qsa
          JOIN sessions s ON qsa.session_id = s.id
          WHERE qsa.quiz_id = ${quiz.id}
        `
        const sessionAccessObj = (sessionAccess as { code: string; is_active: boolean }[]).reduce(
          (acc, row) => {
            acc[row.code] = Boolean(acc[row.code]) || Boolean(row.is_active)
            return acc
          },
          {} as Record<string, boolean>
        )
        const now = new Date()
        const hasActiveSession = (sessionAccess as { is_active: boolean }[]).some((s) => s.is_active)
        const quizWithDates = quiz as { available_from: string | null; available_until: string | null; is_public?: boolean }
        const availableFrom = quizWithDates.available_from ? new Date(quizWithDates.available_from) : null
        const availableUntil = quizWithDates.available_until ? new Date(quizWithDates.available_until) : null
        const availableFromOk = !availableFrom || availableFrom.getTime() <= now.getTime()
        const availableUntilOk = !availableUntil || availableUntil.getTime() >= now.getTime()
        const isPublic = quizWithDates.is_public !== false
        const is_active = hasActiveSession && availableFromOk && availableUntilOk && isPublic
        return {
          ...quiz,
          session_access: sessionAccessObj,
          is_active,
          assessment_type: "quiz",
        }
      })
    )

    return NextResponse.json({ quizzes: quizzesWithAccess })
  } catch (error) {
    console.error("[Quizzes List] Error:", error)
    return NextResponse.json({ error: "Failed to fetch quizzes" }, { status: 500 })
  }
}

