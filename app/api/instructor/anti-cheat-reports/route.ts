import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const maxDuration = 30

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response
    const platformCourseId = scope.course.id
    const instructorIdNum = scope.instructorId
    const actor = await loadInstructorActor(instructorIdNum)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const courseOwnerId = Number(scope.course.instructor_id)

    const perfStart = Date.now()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const assessmentType = searchParams.get("assessmentType") || 'all'
    const severity = searchParams.get('severity') || 'all'


    // Get comprehensive anti-cheat data with conditional filters
    let antiCheatData

    if (startDate && endDate && assessmentType !== 'all') {
      antiCheatData = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.email as student_email,
          s.section as student_section,
          q.title as assessment_title,
          q.assessment_type,
          qa.started_at,
          qa.completed_at,
          qa.score,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          qa.violation_log,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          CASE
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8
            THEN 'HIGH'
            WHEN qa.tab_switch_count > 2 OR qa.copy_paste_attempts > 1 OR qa.mouse_leave_count > 3
            THEN 'MEDIUM'
            WHEN qa.tab_switch_count > 0 OR qa.copy_paste_attempts > 0 OR qa.mouse_leave_count > 0
            THEN 'LOW'
            ELSE 'NONE'
          END as risk_level
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND ${sqlQuizVisibleInCourse("q", actor, instructorIdNum, courseOwnerId, platformCourseId)}
          AND qa.started_at >= ${startDate}
          AND qa.started_at <= ${endDate}
          AND q.assessment_type = ${assessmentType}
        ORDER BY qa.started_at DESC
      `
    } else if (startDate && endDate) {
      antiCheatData = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.email as student_email,
          s.section as student_section,
          q.title as assessment_title,
          q.assessment_type,
          qa.started_at,
          qa.completed_at,
          qa.score,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          qa.violation_log,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          CASE
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8
            THEN 'HIGH'
            WHEN qa.tab_switch_count > 2 OR qa.copy_paste_attempts > 1 OR qa.mouse_leave_count > 3
            THEN 'MEDIUM'
            WHEN qa.tab_switch_count > 0 OR qa.copy_paste_attempts > 0 OR qa.mouse_leave_count > 0
            THEN 'LOW'
            ELSE 'NONE'
          END as risk_level
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND ${sqlQuizVisibleInCourse("q", actor, instructorIdNum, courseOwnerId, platformCourseId)}
          AND qa.started_at >= ${startDate}
          AND qa.started_at <= ${endDate}
        ORDER BY qa.started_at DESC
      `
    } else if (assessmentType !== 'all') {
      antiCheatData = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.email as student_email,
          s.section as student_section,
          q.title as assessment_title,
          q.assessment_type,
          qa.started_at,
          qa.completed_at,
          qa.score,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          qa.violation_log,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          CASE
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8
            THEN 'HIGH'
            WHEN qa.tab_switch_count > 2 OR qa.copy_paste_attempts > 1 OR qa.mouse_leave_count > 3
            THEN 'MEDIUM'
            WHEN qa.tab_switch_count > 0 OR qa.copy_paste_attempts > 0 OR qa.mouse_leave_count > 0
            THEN 'LOW'
            ELSE 'NONE'
          END as risk_level
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND ${sqlQuizVisibleInCourse("q", actor, instructorIdNum, courseOwnerId, platformCourseId)}
          AND q.assessment_type = ${assessmentType}
        ORDER BY qa.started_at DESC
      `
    } else {
      antiCheatData = await sql`
        SELECT 
          qa.id as attempt_id,
          qa.student_id,
          s.full_name as student_name,
          s.email as student_email,
          s.section as student_section,
          q.title as assessment_title,
          q.assessment_type,
          qa.started_at,
          qa.completed_at,
          qa.score,
          ROUND((qa.score::numeric / NULLIF((SELECT SUM(points) FROM quiz_questions WHERE quiz_id = q.id), 0)) * 100, 2) as percentage,
          qa.tab_switch_count,
          qa.copy_paste_attempts,
          qa.mouse_leave_count,
          qa.violation_log,
          EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))::integer as time_taken_seconds,
          qa.is_final_grade,
          CASE
            WHEN qa.tab_switch_count > 5 OR qa.copy_paste_attempts > 3 OR qa.mouse_leave_count > 8
            THEN 'HIGH'
            WHEN qa.tab_switch_count > 2 OR qa.copy_paste_attempts > 1 OR qa.mouse_leave_count > 3
            THEN 'MEDIUM'
            WHEN qa.tab_switch_count > 0 OR qa.copy_paste_attempts > 0 OR qa.mouse_leave_count > 0
            THEN 'LOW'
            ELSE 'NONE'
          END as risk_level
        FROM quiz_attempts qa
        JOIN students s ON qa.student_id = s.id
        JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE q.deleted_at IS NULL
          AND ${sqlQuizVisibleInCourse("q", actor, instructorIdNum, courseOwnerId, platformCourseId)}
        ORDER BY qa.started_at DESC
      `
    }

    // Filter by severity if specified
    let filteredData = antiCheatData
    if (severity !== 'all') {
      filteredData = antiCheatData.filter((record: any) => record.risk_level === severity)
    }

    // Normalize violation_log to JSON arrays and add helper fields
    const normalizedData = (filteredData || []).map((r: any) => {
      let detailedViolations: any[] = []
      try {
        if (Array.isArray(r.violation_log)) {
          detailedViolations = r.violation_log
        } else if (typeof r.violation_log === 'string' && r.violation_log.trim().length > 0) {
          const s = r.violation_log.trim()
          if (s.startsWith('[')) {
            detailedViolations = JSON.parse(s)
          } else if (s.startsWith('{')) {
            // CSV of JSON objects: {..},{..}
            const parts = s.split(/\},\s*\{/)
              .map((chunk, i, arr) => (i === 0 ? chunk : '{' + chunk) + (i === arr.length - 1 ? '' : '}'))
            detailedViolations = parts.map((p) => { try { return JSON.parse(p) } catch { return null } }).filter(Boolean)
          }
        }
      } catch {}
      return {
        ...r,
        detailed_violations: detailedViolations,
        risk_indicators: Array.isArray(detailedViolations)
          ? Array.from(new Set(detailedViolations.map((v: any) => v?.type).filter(Boolean)))
          : []
      }
    })

    // Calculate summary statistics
    const summaryStats = {
      total_attempts: normalizedData.length,
      attempts_with_violations: normalizedData.filter((r: any) => r.risk_level !== 'NONE').length,
      high_risk_attempts: normalizedData.filter((r: any) => r.risk_level === 'HIGH').length,
      medium_risk_attempts: normalizedData.filter((r: any) => r.risk_level === 'MEDIUM').length,
      low_risk_attempts: normalizedData.filter((r: any) => r.risk_level === 'LOW').length,
      avg_tab_switches: normalizedData.reduce((sum: number, r: any) => sum + (r.tab_switch_count || 0), 0) / normalizedData.length || 0,
      avg_copy_paste_attempts: normalizedData.reduce((sum: number, r: any) => sum + (r.copy_paste_attempts || 0), 0) / normalizedData.length || 0,
      avg_mouse_leaves: normalizedData.reduce((sum: number, r: any) => sum + (r.mouse_leave_count || 0), 0) / normalizedData.length || 0,
      violation_rate: normalizedData.length > 0 ? ((normalizedData.filter((r: any) => r.risk_level !== 'NONE').length / normalizedData.length) * 100).toFixed(1) + '%' : '0%'
    }

    // Get top violators
    const topViolators = normalizedData
      .filter((r: any) => r.risk_level !== 'NONE')
      .reduce((acc: any, record: any) => {
        const existing = acc.find((v: any) => v.student_id === record.student_id)
        if (existing) {
          existing.total_violations++
          existing.total_tab_switches += record.tab_switch_count || 0
          existing.total_copy_paste_attempts += record.copy_paste_attempts || 0
          existing.total_mouse_leaves += record.mouse_leave_count || 0
          existing.total_score += record.percentage || 0
          existing.attempt_count++
        } else {
          acc.push({
            student_id: record.student_id,
            student_name: record.student_name,
            student_section: record.student_section,
            total_violations: 1,
            total_tab_switches: record.tab_switch_count || 0,
            total_copy_paste_attempts: record.copy_paste_attempts || 0,
            total_mouse_leaves: record.mouse_leave_count || 0,
            total_score: record.percentage || 0,
            attempt_count: 1
          })
        }
        return acc
      }, [])
      .map((v: any) => ({
        ...v,
        avg_score: v.total_score / v.attempt_count
      }))
      .sort((a: any, b: any) => b.total_violations - a.total_violations)
      .slice(0, 10)

    // Get assessment statistics
    const assessmentStats = normalizedData
      .reduce((acc: any, record: any) => {
        const existing = acc.find((a: any) => a.assessment_title === record.assessment_title)
        if (existing) {
          existing.total_attempts++
          existing.attempts_with_violations += record.risk_level !== 'NONE' ? 1 : 0
          existing.high_risk_attempts += record.risk_level === 'HIGH' ? 1 : 0
          existing.total_score += record.percentage || 0
          existing.attempt_count++
        } else {
          acc.push({
            assessment_title: record.assessment_title,
            assessment_type: record.assessment_type,
            total_attempts: 1,
            attempts_with_violations: record.risk_level !== 'NONE' ? 1 : 0,
            high_risk_attempts: record.risk_level === 'HIGH' ? 1 : 0,
            total_score: record.percentage || 0,
            attempt_count: 1
          })
        }
        return acc
      }, [])
      .map((a: any) => ({
        ...a,
        avg_score: a.total_score / a.attempt_count
      }))
      .sort((a: any, b: any) => b.attempts_with_violations - a.attempts_with_violations)

    // Get risk level distribution (violation_breakdown)
    const violationBreakdown = [
      {
        risk_level: 'HIGH',
        count: summaryStats.high_risk_attempts,
        avg_tab_switches: normalizedData.filter((r: any) => r.risk_level === 'HIGH').reduce((sum: number, r: any) => sum + (r.tab_switch_count || 0), 0) / summaryStats.high_risk_attempts || 0,
        avg_copy_paste_attempts: normalizedData.filter((r: any) => r.risk_level === 'HIGH').reduce((sum: number, r: any) => sum + (r.copy_paste_attempts || 0), 0) / summaryStats.high_risk_attempts || 0
      },
      {
        risk_level: 'MEDIUM',
        count: summaryStats.medium_risk_attempts,
        avg_tab_switches: normalizedData.filter((r: any) => r.risk_level === 'MEDIUM').reduce((sum: number, r: any) => sum + (r.tab_switch_count || 0), 0) / summaryStats.medium_risk_attempts || 0,
        avg_copy_paste_attempts: normalizedData.filter((r: any) => r.risk_level === 'MEDIUM').reduce((sum: number, r: any) => sum + (r.copy_paste_attempts || 0), 0) / summaryStats.medium_risk_attempts || 0
      },
      {
        risk_level: 'LOW',
        count: summaryStats.low_risk_attempts,
        avg_tab_switches: normalizedData.filter((r: any) => r.risk_level === 'LOW').reduce((sum: number, r: any) => sum + (r.tab_switch_count || 0), 0) / summaryStats.low_risk_attempts || 0,
        avg_copy_paste_attempts: normalizedData.filter((r: any) => r.risk_level === 'LOW').reduce((sum: number, r: any) => sum + (r.copy_paste_attempts || 0), 0) / summaryStats.low_risk_attempts || 0
      },
      {
        risk_level: 'NONE',
        count: normalizedData.filter((r: any) => r.risk_level === 'NONE').length,
        avg_tab_switches: 0,
        avg_copy_paste_attempts: 0
      }
    ]

    // Get time trends (group by date)
    const timeTrends = normalizedData
      .reduce((acc: any, record: any) => {
        const date = new Date(record.started_at).toISOString().split('T')[0]
        const existing = acc.find((t: any) => t.date === date)
        if (existing) {
          existing.total_attempts++
          existing.attempts_with_violations += record.risk_level !== 'NONE' ? 1 : 0
        } else {
          acc.push({
            date,
            total_attempts: 1,
            attempts_with_violations: record.risk_level !== 'NONE' ? 1 : 0
          })
        }
        return acc
      }, [])
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30) // Last 30 days

    const response = {
      data: normalizedData,
      summary_stats: summaryStats,
      top_violators: topViolators,
      assessment_stats: assessmentStats,
      violation_breakdown: violationBreakdown,
      time_trends: timeTrends,
      metadata: {
        generated_at: new Date().toISOString(),
        filters: {
          startDate,
          endDate,
          assessmentType,
          severity,
          totalRecords: normalizedData.length
        },
        summary: {
          violation_rate: summaryStats.violation_rate,
          total_attempts: summaryStats.total_attempts,
          attempts_with_violations: summaryStats.attempts_with_violations
        }
      }
    }

    const ms = Date.now() - perfStart
    console.log(`[Perf] /api/instructor/anti-cheat-reports took ${ms}ms`)
    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching anti-cheat reports:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}