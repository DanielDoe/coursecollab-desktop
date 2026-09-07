import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import { resolveInstructorResultsCourseScope } from "@/lib/instructor-results-course-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    // Verify instructor authentication
    const instructorSession = req.headers.get("authorization") || req.headers.get("x-instructor-id")
    
    if (!instructorSession) {
      return NextResponse.json({ error: "Instructor authentication required" }, { status: 401 })
    }

  const params = req.nextUrl.searchParams
  const sessionId = params.get("sessionId")
  const examId = params.get("examId")
  const showAll = params.get("showAll") === "true"

    const scopeResult = await resolveInstructorResultsCourseScope(req)
    if (!scopeResult.ok) return scopeResult.response
    const { studentFilter, quizFilter } = scopeResult.scope

    
    // Build query based on filters
    let results
    
    if (sessionId && sessionId !== "all" && examId && examId !== "all") {
      // Both filters - get most recent completed attempt per student
      results = await sql`
        SELECT DISTINCT ON (qa.student_id, q.id)
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.student_id as student_number,
          s.email as student_email,
          s.section as section,
          q.id as exam_id,
          q.title as exam_title,
          (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score as percentage,
          qa.score,
          qa.started_at,
          qa.completed_at,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          CASE 
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8 
                OR EXISTS (
                  SELECT 1 FROM quiz_answers qans
                  WHERE qans.attempt_id = qa.id
                  AND qans.requires_review = true
                  AND qans.reviewed_at IS NULL
                  AND qans.reviewed_by IS NULL
                  AND qans.override_points IS NULL
                )
            THEN true 
            ELSE false 
          END as is_flagged
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND qa.deleted_at IS NULL
          AND q.assessment_type = 'mid_semester'
          AND s.session_id = ${sessionId}
          AND q.id = ${examId}
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    } else if (sessionId && sessionId !== "all") {
      // Session filter only - get most recent completed attempt per student per exam
      results = await sql`
        SELECT DISTINCT ON (qa.student_id, q.id)
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.student_id as student_number,
          s.email as student_email,
          s.section as section,
          q.id as exam_id,
          q.title as exam_title,
          (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score as percentage,
          qa.score,
          qa.started_at,
          qa.completed_at,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          CASE 
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8 
                OR EXISTS (
                  SELECT 1 FROM quiz_answers qans
                  WHERE qans.attempt_id = qa.id
                  AND qans.requires_review = true
                  AND qans.reviewed_at IS NULL
                  AND qans.reviewed_by IS NULL
                  AND qans.override_points IS NULL
                )
            THEN true 
            ELSE false 
          END as is_flagged
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND q.assessment_type = 'mid_semester'
          AND s.session_id = ${sessionId}
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    } else if (examId && examId !== "all") {
      // Exam filter only - get most recent completed attempt per student
      results = await sql`
        SELECT DISTINCT ON (qa.student_id, q.id)
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.student_id as student_number,
          s.email as student_email,
          s.section as section,
          q.id as exam_id,
          q.title as exam_title,
          (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score as percentage,
          qa.score,
          qa.started_at,
          qa.completed_at,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          CASE 
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8 
                OR EXISTS (
                  SELECT 1 FROM quiz_answers qans
                  WHERE qans.attempt_id = qa.id
                  AND qans.requires_review = true
                  AND qans.reviewed_at IS NULL
                  AND qans.reviewed_by IS NULL
                  AND qans.override_points IS NULL
                )
            THEN true 
            ELSE false 
          END as is_flagged
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND qa.deleted_at IS NULL
          AND q.assessment_type = 'mid_semester'
          AND q.id = ${examId}
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    } else {
      // No filters - all mid-semester results (most recent attempt per student per exam)
      results = await sql`
        SELECT DISTINCT ON (qa.student_id, q.id)
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.student_id as student_number,
          s.email as student_email,
          s.section as section,
          q.id as exam_id,
          q.title as exam_title,
          (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score as percentage,
          qa.score,
          qa.started_at,
          qa.completed_at,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          CASE 
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8 
                OR EXISTS (
                  SELECT 1 FROM quiz_answers qans
                  WHERE qans.attempt_id = qa.id
                  AND qans.requires_review = true
                  AND qans.reviewed_at IS NULL
                  AND qans.reviewed_by IS NULL
                  AND qans.override_points IS NULL
                )
            THEN true 
            ELSE false 
          END as is_flagged
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND q.assessment_type = 'mid_semester'
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    }

    /** Same % / points as results viewer, emails, and Canvas export — not raw `qa.score` alone. */
    const normalizedRows = await Promise.all(
      (results as Record<string, unknown>[]).map(async (r) => {
        const attemptId = String(r.attempt_id ?? "")
        const g = await getAttemptDisplayGrade(attemptId)
        const fallbackPct = Math.min(
          100,
          Math.max(0, parseFloat(String(r.percentage ?? r.score ?? 0))),
        )
        const percentage = g
          ? Math.min(100, Math.max(0, g.percentage))
          : fallbackPct
        const score = g ? g.score : fallbackPct
        const totalPoints = g ? g.totalPoints : 100
        return { row: r, percentage, score, totalPoints }
      }),
    )

    // Calculate statistics
    const stats = {
      totalAttempts: normalizedRows.length,
      averageScore:
        normalizedRows.length > 0
          ? Math.round(
              (normalizedRows.reduce((sum, { percentage }) => sum + percentage, 0) /
                normalizedRows.length) *
                10,
            ) / 10
          : 0,
      highestScore:
        normalizedRows.length > 0
          ? Math.max(...normalizedRows.map(({ percentage }) => percentage))
          : 0,
      lowestScore:
        normalizedRows.length > 0
          ? Math.min(...normalizedRows.map(({ percentage }) => percentage))
          : 0,
      flaggedAttempts: normalizedRows.filter(({ row }) => (row as { is_flagged?: boolean }).is_flagged)
        .length,
      completionRate:
        normalizedRows.length > 0
          ? Math.round(
              (normalizedRows.filter(({ row }) => (row as { completed_at?: unknown }).completed_at).length /
                normalizedRows.length) *
                100,
            )
          : 0,
      gradeDistribution: {
        A: normalizedRows.filter(({ percentage }) => percentage >= 90).length,
        B: normalizedRows.filter(({ percentage }) => percentage >= 80 && percentage < 90).length,
        C: normalizedRows.filter(({ percentage }) => percentage >= 70 && percentage < 80).length,
        D: normalizedRows.filter(({ percentage }) => percentage >= 60 && percentage < 70).length,
        F: normalizedRows.filter(({ percentage }) => percentage < 60).length,
      },
    }

    return NextResponse.json({
      results: normalizedRows.map(({ row: r, percentage, score, totalPoints }) => ({
        attemptId: r.attempt_id,
        studentId: r.student_id,
        studentName: r.student_name,
        studentNumber: r.student_number,
        studentEmail: r.student_email,
        section: r.section,
        examId: r.exam_id,
        examTitle: r.exam_title,
        totalPoints,
        assessmentType: r.assessment_type,
        score,
        percentage,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        timeTakenSeconds: r.time_taken_seconds,
        isFinalGrade: r.is_final_grade,
        tabSwitchCount: r.tab_switch_count || 0,
        copyPasteAttempts: r.copy_paste_attempts || 0,
        mouseLeaveCount: r.mouse_leave_count || 0,
        isFlagged: r.is_flagged,
      })),
      stats,
      filters: {
        sessionId: sessionId || "all",
        examId: examId || "all"
      },
      success: true
    })
  } catch (error) {
    console.error("Error fetching mid-semester results:", error)
    return NextResponse.json(
      { error: "Failed to fetch mid-semester results" },
      { status: 500 }
    )
  }
}

