import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
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
          (SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
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
          AND q.assessment_type = 'final'
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
          (SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
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
          AND q.assessment_type = 'final'
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
          (SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
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
          AND q.assessment_type = 'final'
          AND q.id = ${examId}
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    } else {
      // No filters - all final exam results (most recent attempt per student per exam)
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
          (SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
          q.assessment_type,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(COALESCE(max_points, points, 1)) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
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
          AND q.assessment_type = 'final'
          AND qa.deleted_at IS NULL
          AND qa.completed_at IS NOT NULL
          ${studentFilter}
          ${quizFilter}
        ORDER BY qa.student_id, q.id, qa.completed_at DESC NULLS LAST
      `
    }

    // Map results and calculate percentages properly
    const mappedResults = results.map(r => {
      // Calculate percentage properly: (score / total_points) * 100
      const totalPoints = parseFloat(r.total_points || 0)
      const score = parseFloat(r.score || 0)
      const percentage = totalPoints > 0 
        ? Math.min(100, Math.max(0, (score / totalPoints) * 100))
        : 0
      
      return {
        attemptId: r.attempt_id,
        studentId: r.student_id,
        studentName: r.student_name,
        studentNumber: r.student_number,
        studentEmail: r.student_email,
        section: r.section,
        examId: r.exam_id,
        examTitle: r.exam_title,
        totalPoints: totalPoints,
        assessmentType: r.assessment_type,
        score: score,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
        startedAt: r.started_at,
        completedAt: r.completed_at,
        timeTakenSeconds: r.time_taken_seconds,
        isFinalGrade: r.is_final_grade,
        tabSwitchCount: r.tab_switch_count || 0,
        copyPasteAttempts: r.copy_paste_attempts || 0,
        mouseLeaveCount: r.mouse_leave_count || 0,
        isFlagged: r.is_flagged
      }
    })
    
    // Calculate statistics using properly calculated percentages
    const stats = {
      totalAttempts: mappedResults.length,
      averageScore: mappedResults.length > 0 
        ? Math.round((mappedResults.reduce((sum: number, r: any) => sum + r.percentage, 0) / mappedResults.length) * 10) / 10
        : 0,
      highestScore: mappedResults.length > 0 
        ? Math.max(...mappedResults.map((r: any) => r.percentage))
        : 0,
      lowestScore: mappedResults.length > 0 
        ? Math.min(...mappedResults.map((r: any) => r.percentage))
        : 0,
      flaggedAttempts: mappedResults.filter((r: any) => r.isFlagged).length,
      completionRate: mappedResults.length > 0
        ? Math.round((mappedResults.filter((r: any) => r.completedAt).length / mappedResults.length) * 100)
        : 0,
      gradeDistribution: {
        A: mappedResults.filter((r: any) => r.percentage >= 90).length,
        B: mappedResults.filter((r: any) => r.percentage >= 80 && r.percentage < 90).length,
        C: mappedResults.filter((r: any) => r.percentage >= 70 && r.percentage < 80).length,
        D: mappedResults.filter((r: any) => r.percentage >= 60 && r.percentage < 70).length,
        F: mappedResults.filter((r: any) => r.percentage < 60).length
      }
    }
    
    return NextResponse.json({
      results: mappedResults,
      stats,
      filters: {
        sessionId: sessionId || "all",
        examId: examId || "all"
      },
      success: true
    })
  } catch (error) {
    console.error("Error fetching final exam results:", error)
    return NextResponse.json(
      { error: "Failed to fetch final exam results", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

