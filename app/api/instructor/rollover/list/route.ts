import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/rollover/list?quizId=123
 * List students who have been granted rollover for a specific quiz.
 */
export async function GET(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id") || request.headers.get("authorization")
    if (!instructorId) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get("quizId")
    if (!quizId) {
      return NextResponse.json({ error: "quizId is required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        sess.code as section,
        r.applied_at,
        r.expires_at,
        CASE WHEN r.expires_at > NOW() THEN true ELSE false END as is_active,
        CASE WHEN EXISTS (SELECT 1 FROM grade_rollover_trades grt WHERE grt.student_id = r.student_id AND grt.quiz_id = r.quiz_id) THEN 'points' ELSE 'instructor' END as source
      FROM student_assessment_rollovers r
      JOIN students s ON s.id = r.student_id
      LEFT JOIN sessions sess ON s.session_id = sess.id
      WHERE r.quiz_id = ${Number(quizId)}
      ORDER BY r.applied_at DESC
    `

    const quizIdNum = Number(quizId)
    const studentIds = rows.map((r: { student_id: number }) => r.student_id)
    const overrides =
      studentIds.length > 0
        ? await sql`
            SELECT student_id, additional_attempts
            FROM attempt_overrides
            WHERE quiz_id = ${quizIdNum}
              AND student_id = ANY(${studentIds})
              AND is_active = TRUE
              AND (expires_at IS NULL OR expires_at > NOW())
          `
        : []

    const overrideByStudent = new Map(
      (overrides as { student_id: number; additional_attempts: number }[]).map((o) => [o.student_id, o.additional_attempts])
    )

    return NextResponse.json({
      students: rows.map((r: { student_id: number; full_name: string; student_number: string; section: string | null; applied_at: string; expires_at: string; is_active: boolean; source?: string }) => ({
        studentId: r.student_id,
        fullName: r.full_name,
        studentNumber: r.student_number,
        section: r.section,
        appliedAt: r.applied_at,
        expiresAt: r.expires_at,
        isActive: r.is_active,
        source: r.source || "instructor",
        hasRetakeOverride: overrideByStudent.has(r.student_id),
        retakeAttempts: overrideByStudent.get(r.student_id) ?? 0,
      })),
    })
  } catch (error) {
    console.error("[Rollover List] Error:", error)
    return NextResponse.json({ error: "Failed to list rollovers" }, { status: 500 })
  }
}
