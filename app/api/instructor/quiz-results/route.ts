import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { quizAttemptEffectiveCompletedAtExpr } from "@/lib/quiz-attempt-completed-at"
import {
  resolveInstructorResultsCourseScope,
  sessionCourseFilter,
} from "@/lib/instructor-results-course-scope"
import { getAttemptDisplayGradesBatch } from "@/lib/attempt-grade-display"

const QA_COMPLETED_AT_EFF = quizAttemptEffectiveCompletedAtExpr("qa")

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
  const quizId = params.get("quizId")
  const showAll = params.get("showAll") === "true"
  const rawAssessmentType = params.get("assessmentType")?.trim() || ""
  // Align with /api/[assessmentType]/list: non-quiz menus are strict; quiz includes NULL assessment_type.
  // Default omitted param to quiz so anonymous callers never see homework/midterm/final mixed in.
  const assessmentType =
    rawAssessmentType === "midsem"
      ? "mid_semester"
      : rawAssessmentType === "finals"
        ? "final"
        : rawAssessmentType || "quiz"

    const scopeResult = await resolveInstructorResultsCourseScope(req)
    if (!scopeResult.ok) return scopeResult.response
    const { studentFilter, quizFilter } = scopeResult.scope
    const sessionCourseClause = sessionCourseFilter(scopeResult.scope.scopedCourseId)

    // Build query based on filters
    /* Rows may be final-grade (or score override) with NULL completed_at — see lib/quiz-attempt-completed-at */
    let results
    
    if (sessionId && sessionId !== "all" && quizId && quizId !== "all") {
      // Both filters - sessionId is the sessions.id, need to get the code
      const sessionCode = await sql`
        SELECT code FROM sessions WHERE id = ${parseInt(sessionId)} ${sessionCourseClause}
      `
      const sectionCode = sessionCode.length > 0 ? sessionCode[0].code : null
      
      if (!sectionCode) {
        return NextResponse.json({ results: [], stats: null, filters: { sessionId, quizId }, success: true })
      }

      const sectionVariants = normalizedSectionVariantsForSql(String(sectionCode))
      
      // Build query with explicit conditionals to avoid SQL syntax errors
      if (!showAll) {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
            AND q.id = ${parseInt(quizId)}
            AND qa.is_final_grade = true
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      } else {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
            AND q.id = ${parseInt(quizId)}
            AND (
              qa.completed_at IS NOT NULL
              OR qa.is_final_grade = true
              OR qa.total_score_override IS NOT NULL
            )
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      }
    } else if (sessionId && sessionId !== "all") {
      // Session filter only - sessionId is the sessions.id, need to get the code
      const sessionCode = await sql`
        SELECT code FROM sessions WHERE id = ${parseInt(sessionId)} ${sessionCourseClause}
      `
      const sectionCode = sessionCode.length > 0 ? sessionCode[0].code : null
      
      if (!sectionCode) {
        return NextResponse.json({ results: [], stats: null, filters: { sessionId, quizId: "all" }, success: true })
      }

      const sectionVariants = normalizedSectionVariantsForSql(String(sectionCode))
      
      // Build query with explicit conditionals to avoid SQL syntax errors
      if (!showAll) {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
            AND qa.is_final_grade = true
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      } else {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND (
              TRIM(s.section) = ANY(${sectionVariants}::text[])
              OR EXISTS (
                SELECT 1 FROM sessions sess
                WHERE sess.id = s.session_id
                  AND TRIM(sess.code) = ANY(${sectionVariants}::text[])
              )
            )
            AND (
              qa.completed_at IS NOT NULL
              OR qa.is_final_grade = true
              OR qa.total_score_override IS NOT NULL
            )
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      }
    } else if (quizId && quizId !== "all") {
      // Quiz filter only
      if (!showAll) {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND q.id = ${parseInt(quizId)}
            AND qa.is_final_grade = true
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      } else {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND q.id = ${parseInt(quizId)}
            AND (
              qa.completed_at IS NOT NULL
              OR qa.is_final_grade = true
              OR qa.total_score_override IS NOT NULL
            )
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      }
    } else {
      console.log('   Using: No filters - all results');
      if (!showAll) {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND qa.is_final_grade = true
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      } else {
        results = await sql`
          SELECT 
            qa.id as attempt_id,
            qa.student_id,
            s.full_name as student_name,
            s.student_id as student_number,
            s.email as student_email,
            s.section as section,
            q.id as quiz_id,
            q.title as quiz_title,
            (SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id) as total_points,
            q.assessment_type,
            qa.score,
            qa.total_score_override,
            ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
            qa.started_at,
            ${sql.unsafe(QA_COMPLETED_AT_EFF)} as completed_at,
            EXTRACT(EPOCH FROM ((${sql.unsafe(QA_COMPLETED_AT_EFF)}) - qa.started_at))::integer as time_taken_seconds,
            qa.is_final_grade,
            qa.tab_switch_count,
            qa.copy_paste_attempts,
            qa.mouse_leave_count,
            CASE 
              WHEN qa.tab_switch_count > 3 OR qa.copy_paste_attempts > 2 OR qa.mouse_leave_count > 5 
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
            AND (q.assessment_type = ${assessmentType} OR (q.assessment_type IS NULL AND ${assessmentType} = 'quiz'))
            AND (
              qa.completed_at IS NOT NULL
              OR qa.is_final_grade = true
              OR qa.total_score_override IS NOT NULL
            )
            ${studentFilter}
            ${quizFilter}
          ORDER BY ${sql.unsafe(QA_COMPLETED_AT_EFF)} DESC NULLS LAST, s.full_name ASC
        `
      }
    }
    
    // Align scores with results report / student list (section-weighted, overrides, mid-semester).
    const attemptIds = (results as Array<{ attempt_id: number }>)
      .map((r) => Number(r.attempt_id))
      .filter((id) => Number.isFinite(id) && id > 0)
    const displayGrades = await getAttemptDisplayGradesBatch(attemptIds)

    const recalculatedResults = (results as Array<Record<string, unknown>>).map((r) => {
      const grade = displayGrades.get(Number(r.attempt_id))
      if (!grade) return r
      return {
        ...r,
        score: grade.score,
        total_points: grade.totalPoints,
        percentage: grade.percentage,
      }
    })
    
    // Calculate statistics
    const stats = {
      totalAttempts: recalculatedResults.length,
      averageScore: recalculatedResults.length > 0 
        ? Math.round((recalculatedResults.reduce((sum: number, r: any) => sum + parseFloat(r.percentage || 0), 0) / recalculatedResults.length) * 10) / 10
        : 0,
      highestScore: recalculatedResults.length > 0 
        ? Math.max(...recalculatedResults.map((r: any) => parseFloat(r.percentage || 0)))
        : 0,
      lowestScore: recalculatedResults.length > 0 
        ? Math.min(...recalculatedResults.map((r: any) => parseFloat(r.percentage || 0)))
        : 0,
      flaggedAttempts: recalculatedResults.filter((r: any) => r.is_flagged).length,
      completionRate: recalculatedResults.length > 0
        ? Math.round((recalculatedResults.filter((r: any) => r.completed_at).length / recalculatedResults.length) * 100)
        : 0
    }
    
    return NextResponse.json({
      results: recalculatedResults.map(r => ({
        attemptId: r.attempt_id,
        studentId: r.student_id,
        studentName: r.student_name,
        studentNumber: r.student_number,
        studentEmail: r.student_email,
        section: r.section,
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        totalPoints: parseFloat(r.total_points),
        assessmentType: r.assessment_type,
        score: parseFloat(r.score),
        percentage: parseFloat(r.percentage),
        startedAt: r.started_at,
        completedAt: r.completed_at,
        timeTakenSeconds: r.time_taken_seconds,
        isFinalGrade: r.is_final_grade,
        tabSwitchCount: r.tab_switch_count || 0,
        copyPasteAttempts: r.copy_paste_attempts || 0,
        mouseLeaveCount: r.mouse_leave_count || 0,
        isFlagged: r.is_flagged
      })),
      stats,
      filters: {
        sessionId: sessionId || "all",
        quizId: quizId || "all"
      },
      success: true
    })
  } catch (error) {
    console.error("Error fetching quiz results:", error)
    return NextResponse.json(
      { error: "Failed to fetch quiz results" },
      { status: 500 }
    )
  }
}

