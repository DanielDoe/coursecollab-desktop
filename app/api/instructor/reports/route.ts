import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  SQL_QUIZ_MAX_POINTS,
  attemptCompletedDateSql,
  flattenLearningAnalyticsForTables,
} from "@/lib/instructor-reports-api"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"
import { sessionOfferingAndSql, studentOfferingAndSql } from "@/lib/instructor-session-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const scope = await requireInstructorCourse(req)
    if (!scope.ok) return scope.response

    const actor = await loadInstructorActor(scope.instructorId)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const courseOwnerId = Number(scope.course.instructor_id)
    const courseId = scope.course.id

    const params = req.nextUrl.searchParams
    const type = params.get("type") || "all"
    const startDate = params.get("startDate")
    const endDate = params.get("endDate")

    let reports: any[] = []

    try {
      const reportData = await sql`
        SELECT 
          'quiz_summary' as type,
          COUNT(*) as total_reports,
          NOW() as generated_at
        FROM quizzes q
        WHERE q.deleted_at IS NULL
          AND ${sqlQuizVisibleInCourse("q", actor, scope.instructorId, courseOwnerId, courseId)}
      `

      reports = reportData.map((r) => ({
        type: r.type,
        totalReports: parseInt(String(r.total_reports), 10),
        generatedAt: r.generated_at,
      }))
    } catch (error) {
      console.error("Error fetching reports summary:", error)
      reports = []
    }

    return NextResponse.json({
      reports,
      filters: {
        type,
        startDate,
        endDate,
      },
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error in reports GET:", error)
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const scope = await requireInstructorCourse(req)
    if (!scope.ok) return scope.response
    const platformCourseId = scope.course.id
    const instructorId = scope.instructorId
    const actor = await loadInstructorActor(instructorId)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const courseOwnerId = Number(scope.course.instructor_id)

    const body = await req.json()
    const { reportType, format = "json", filters = {} } = body
    const dateSql = attemptCompletedDateSql(filters as Record<string, unknown>)
    const offeringSt = studentOfferingAndSql(req, platformCourseId, "st")
    const offeringS = studentOfferingAndSql(req, platformCourseId, "s")
    const offeringSt2 = studentOfferingAndSql(req, platformCourseId, "st2")
    const offeringSess = sessionOfferingAndSql(req, platformCourseId, "s")
    const offeringSe = sessionOfferingAndSql(req, platformCourseId, "se")

    let reportData: any = []
    let extraMetadata: Record<string, unknown> = {}

    switch (reportType) {
      case "quiz-performance": {
        const quizData = await sql`
            SELECT 
              q.id as quiz_id,
              q.title as quiz_name,
              q.assessment_type,
              (SELECT COALESCE(SUM(COALESCE(qq.points, qq.max_points, 1)), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as total_points,
              COUNT(DISTINCT qa.id) as total_attempts,
              COUNT(DISTINCT qa.student_id) as unique_students,
              ROUND(AVG(qa.score)::numeric, 2) as average_score,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as average_percentage,
              MAX(qa.score) as highest_score,
              MIN(qa.score) as lowest_score,
              COUNT(CASE WHEN qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) >= 0.9 THEN 1 END) as a_grades,
              COUNT(CASE WHEN qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) >= 0.8 AND qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) < 0.9 THEN 1 END) as b_grades,
              COUNT(CASE WHEN qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) >= 0.7 AND qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) < 0.8 THEN 1 END) as c_grades,
              COUNT(CASE WHEN qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) >= 0.6 AND qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) < 0.7 THEN 1 END) as d_grades,
              COUNT(CASE WHEN qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0) < 0.6 THEN 1 END) as f_grades,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)))::numeric, 0) as avg_time_seconds
            FROM quizzes q
            INNER JOIN quiz_attempts qa ON q.id = qa.quiz_id
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            INNER JOIN students st ON qa.student_id = st.id AND (st.deleted_at IS NULL)
            INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId} ${offeringSt}
            WHERE q.deleted_at IS NULL
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            GROUP BY q.id, q.title, q.assessment_type
            ORDER BY q.title
          `
        reportData = quizData.map((quiz) => ({
          quizName: quiz.quiz_name,
          assessmentType: quiz.assessment_type || "quiz",
          totalPoints: parseFloat(String(quiz.total_points)) || 0,
          totalAttempts: parseInt(String(quiz.total_attempts), 10) || 0,
          uniqueStudents: parseInt(String(quiz.unique_students), 10) || 0,
          averageScore: parseFloat(String(quiz.average_score)) || 0,
          averagePercentage: parseFloat(String(quiz.average_percentage)) || 0,
          highestScore: parseFloat(String(quiz.highest_score)) || 0,
          lowestScore: parseFloat(String(quiz.lowest_score)) || 0,
          gradeDistribution: {
            A: parseInt(String(quiz.a_grades), 10) || 0,
            B: parseInt(String(quiz.b_grades), 10) || 0,
            C: parseInt(String(quiz.c_grades), 10) || 0,
            D: parseInt(String(quiz.d_grades), 10) || 0,
            F: parseInt(String(quiz.f_grades), 10) || 0,
          },
          avgTimeMinutes: Math.round(
            (parseInt(String(quiz.avg_time_seconds), 10) || 0) / 60,
          ),
          completionRate:
            parseInt(String(quiz.unique_students), 10) > 0
              ? Math.round(
                  (parseInt(String(quiz.total_attempts), 10) /
                    parseInt(String(quiz.unique_students), 10)) *
                    100,
                )
              : 0,
          difficultyLevel:
            parseFloat(String(quiz.average_percentage)) > 80
              ? "Easy"
              : parseFloat(String(quiz.average_percentage)) > 60
                ? "Medium"
                : "Hard",
          performanceInsight:
            parseFloat(String(quiz.average_percentage)) > 90
              ? "Excellent performance - students are mastering this content"
              : parseFloat(String(quiz.average_percentage)) > 70
                ? "Good performance - consider adding challenging questions"
                : parseFloat(String(quiz.average_percentage)) > 50
                  ? "Moderate performance - students may need additional support"
                  : "Challenging content - consider reviewing and providing more resources",
          recommendation:
            parseFloat(String(quiz.average_percentage)) < 60
              ? "Consider reviewing quiz content and providing additional study materials"
              : parseFloat(String(quiz.average_percentage)) > 85
                ? "Content appears well-mastered - consider advancing to next level"
                : "Monitor student progress and provide targeted support as needed",
        }))
        break
      }

      case "student-progress": {
        const studentData = await sql`
            SELECT 
              s.id,
              s.full_name,
              s.student_id,
              s.email,
              s.section,
              COUNT(DISTINCT qa.quiz_id) as quizzes_taken,
              COUNT(qa.id) as total_attempts,
              ROUND(AVG(qa.score)::numeric, 2) as average_score,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as average_percentage,
              MAX(qa.completed_at) as last_activity,
              SUM(CASE WHEN COALESCE(qa.tab_switch_count,0) > 3 OR COALESCE(qa.copy_paste_attempts,0) > 2 THEN 1 ELSE 0 END) as flagged_attempts,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)))::numeric / 60, 1) as avg_time_per_quiz_minutes
            FROM students s
            INNER JOIN sessions sess_sc ON s.session_id = sess_sc.id AND sess_sc.course_id = ${platformCourseId} ${offeringS}
            INNER JOIN quiz_attempts qa ON s.id = qa.student_id
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            WHERE (s.deleted_at IS NULL)
            GROUP BY s.id, s.full_name, s.student_id, s.email, s.section
            HAVING COUNT(qa.id) > 0
            ORDER BY s.full_name
          `
      reportData = studentData.map((student) => ({
          studentName: student.full_name || "Unknown",
          studentId: student.student_id ?? "N/A",
          email: student.email || "",
          section: student.section || "N/A",
          quizzesTaken: parseInt(String(student.quizzes_taken), 10) || 0,
          totalAttempts: parseInt(String(student.total_attempts), 10) || 0,
          averageScore: parseFloat(String(student.average_score)) || 0,
          averagePercentage: parseFloat(String(student.average_percentage)) || 0,
          lastActivity: student.last_activity || "Never",
          flaggedAttempts: parseInt(String(student.flagged_attempts), 10) || 0,
          avgTimePerQuiz:
            parseFloat(String(student.avg_time_per_quiz_minutes)) || 0,
          status:
            parseInt(String(student.flagged_attempts), 10) > 0
              ? "At Risk"
              : "Good Standing",
          performanceLevel:
            parseFloat(String(student.average_percentage)) > 90
              ? "Excellent"
              : parseFloat(String(student.average_percentage)) > 80
                ? "Very Good"
                : parseFloat(String(student.average_percentage)) > 70
                  ? "Good"
                  : parseFloat(String(student.average_percentage)) > 60
                    ? "Satisfactory"
                    : "Needs Improvement",
          engagementLevel:
            parseInt(String(student.total_attempts), 10) > 5
              ? "High"
              : parseInt(String(student.total_attempts), 10) > 2
                ? "Moderate"
                : "Low",
          riskAssessment:
            parseInt(String(student.flagged_attempts), 10) > 3
              ? "High Risk - Multiple violations detected"
              : parseInt(String(student.flagged_attempts), 10) > 0
                ? "Medium Risk - Some violations noted"
                : "Low Risk - No violations detected",
          recommendation:
            parseFloat(String(student.average_percentage)) < 60
              ? "Student needs additional support and resources"
              : parseInt(String(student.flagged_attempts), 10) > 0
                ? "Monitor student behavior and provide guidance"
                : parseFloat(String(student.average_percentage)) > 85
                  ? "Excellent student - consider advanced opportunities"
                  : "Continue monitoring progress",
        }))
        break
      }

      case "session-analytics": {
        const sessionData = await sql`
            SELECT 
              s.id,
              s.code as session_name,
              s.description,
              COUNT(DISTINCT st.id) as total_students,
              COUNT(DISTINCT q.id) as total_quizzes,
              COUNT(qa.id) as total_attempts,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as avg_percentage,
              COUNT(DISTINCT CASE WHEN qa.completed_at > NOW() - INTERVAL '7 days' THEN qa.student_id END) as active_last_week,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)))::numeric / 60, 1) as avg_time_minutes
            FROM sessions s
            LEFT JOIN students st ON s.id = st.session_id AND (st.deleted_at IS NULL)
            LEFT JOIN quiz_attempts qa ON st.id = qa.student_id
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            LEFT JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            WHERE s.course_id = ${platformCourseId}
            ${offeringSess}
            GROUP BY s.id, s.code, s.description
            ORDER BY s.code
          `
        reportData = sessionData.map((session) => ({
          sessionName: session.session_name || "Unknown",
          description: session.description || "",
          totalStudents: parseInt(String(session.total_students), 10) || 0,
          totalQuizzes: parseInt(String(session.total_quizzes), 10) || 0,
          totalAttempts: parseInt(String(session.total_attempts), 10) || 0,
          averagePercentage: parseFloat(String(session.avg_percentage)) || 0,
          activeLastWeek: parseInt(String(session.active_last_week), 10) || 0,
          avgTimeMinutes: parseFloat(String(session.avg_time_minutes)) || 0,
          engagementRate:
            parseInt(String(session.total_students), 10) > 0
              ? Math.round(
                  (parseInt(String(session.active_last_week), 10) /
                    parseInt(String(session.total_students), 10)) *
                    100,
                )
              : 0,
        }))
        break
      }

      case "assessment-summary": {
        const assessmentData = await sql`
            SELECT 
              q.assessment_type,
              COUNT(DISTINCT q.id) as total_assessments,
              COUNT(qa.id) as total_submissions,
              COUNT(DISTINCT qa.student_id) as unique_students,
              ROUND(AVG((
                qa.score::numeric / NULLIF(
                  (SELECT COALESCE(SUM(COALESCE(qq.max_points, qq.points, 1)), 0) FROM quiz_questions qq WHERE qq.quiz_id = q.id),
                  0
                )
              ) * 100), 2) as avg_percentage,
              ROUND(AVG(
                (SELECT COALESCE(SUM(COALESCE(qqm.max_points, qqm.points, 1)), 0) FROM quiz_questions qqm WHERE qqm.quiz_id = q.id)::numeric
              ), 2) as avg_points_possible,
              COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) as completed,
              COUNT(CASE WHEN qa.id IS NOT NULL AND qa.completed_at IS NULL THEN 1 END) as incomplete
            FROM quizzes q
            INNER JOIN quiz_attempts qa ON q.id = qa.quiz_id
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            INNER JOIN students st ON qa.student_id = st.id AND (st.deleted_at IS NULL)
            INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId} ${offeringSt}
            WHERE q.deleted_at IS NULL
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            GROUP BY q.assessment_type
            ORDER BY q.assessment_type
          `
        reportData = assessmentData.map((assessment) => ({
          assessmentType: assessment.assessment_type || "quiz",
          totalAssessments: parseInt(String(assessment.total_assessments), 10) || 0,
          totalSubmissions: parseInt(String(assessment.total_submissions), 10) || 0,
          uniqueStudents: parseInt(String(assessment.unique_students), 10) || 0,
          averagePercentage: parseFloat(String(assessment.avg_percentage)) || 0,
          avgPointsPossible:
            parseFloat(String(assessment.avg_points_possible)) || 0,
          completionRate:
            parseInt(String(assessment.total_submissions), 10) > 0
              ? Math.round(
                  (parseInt(String(assessment.completed), 10) /
                    parseInt(String(assessment.total_submissions), 10)) *
                    100,
                )
              : 0,
          completed: parseInt(String(assessment.completed), 10) || 0,
          incomplete: parseInt(String(assessment.incomplete), 10) || 0,
        }))
        break
      }

      case "completion-rates": {
        const completionData = await sql`
            SELECT 
              q.id,
              q.title as quiz_name,
              q.assessment_type,
              COALESCE(enr.eligible_students, 0)::bigint AS eligible_students,
              COUNT(DISTINCT CASE 
                WHEN qa.completed_at IS NOT NULL 
                  AND qa.deleted_at IS NULL 
                  AND (qa.is_final_grade IS DISTINCT FROM false) 
                THEN qa.student_id END) AS students_completed,
              COUNT(DISTINCT CASE WHEN qa.completed_at IS NOT NULL THEN qa.student_id END) AS students_touched,
              COUNT(qa.id) FILTER (
                WHERE qa.completed_at IS NOT NULL 
                  AND qa.deleted_at IS NULL 
                  AND (qa.is_final_grade IS DISTINCT FROM false)
              ) AS total_attempts,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at))) FILTER (WHERE qa.completed_at IS NOT NULL)::numeric / 60, 1) as avg_completion_time_minutes,
              COUNT(CASE WHEN qa.completed_at IS NOT NULL AND q.available_until IS NOT NULL AND qa.completed_at > q.available_until THEN 1 END) as late_submissions
            FROM quizzes q
            LEFT JOIN LATERAL (
              SELECT COUNT(DISTINCT s.id)::bigint AS eligible_students
              FROM quiz_session_access qsa
              INNER JOIN sessions se ON se.id = qsa.session_id AND se.course_id = ${platformCourseId} ${offeringSe}
              INNER JOIN students s ON s.session_id = qsa.session_id AND (s.deleted_at IS NULL) ${offeringS}
              WHERE qsa.quiz_id = q.id AND (qsa.is_active IS DISTINCT FROM false)
            ) enr ON true
            LEFT JOIN quiz_attempts qa ON qa.quiz_id = q.id AND (qa.deleted_at IS NULL)
              AND EXISTS (
                SELECT 1 FROM students st2
                INNER JOIN sessions se2 ON st2.session_id = se2.id AND se2.course_id = ${platformCourseId}
                WHERE st2.id = qa.student_id
                ${offeringSt2}
              )
            WHERE q.deleted_at IS NULL
              AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            GROUP BY q.id, q.title, q.assessment_type, enr.eligible_students
            ORDER BY q.title
          `
        reportData = completionData.map((quiz) => {
          const eligible =
            parseInt(String(quiz.eligible_students), 10) || 0
          const done =
            parseInt(String(quiz.students_completed), 10) || 0
          const touched =
            parseInt(String(quiz.students_touched), 10) || 0
          const denom =
            eligible > 0 ? eligible : Math.max(touched, done, 1)
          const completionRate = Math.round((done / denom) * 100)
          return {
            quizName: quiz.quiz_name,
            assessmentType: quiz.assessment_type || "quiz",
            eligibleStudents: eligible,
            studentsCompleted: done,
            studentsTouched: touched,
            totalStudents: eligible > 0 ? eligible : touched,
            completionRate,
            totalAttempts: parseInt(String(quiz.total_attempts), 10) || 0,
            avgCompletionTime:
              parseFloat(String(quiz.avg_completion_time_minutes)) || 0,
            lateSubmissions:
              parseInt(String(quiz.late_submissions), 10) || 0,
          }
        })
        break
      }

      case "learning-analytics": {
        const learningData = await sql`
            SELECT 
              DATE(qa.completed_at) as attempt_date,
              COUNT(qa.id) as daily_attempts,
              COUNT(DISTINCT qa.student_id) as active_students,
              ROUND(AVG(qa.score)::numeric, 2) as avg_score,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as avg_percentage,
              COUNT(CASE WHEN COALESCE(qa.tab_switch_count,0) > 3 OR COALESCE(qa.copy_paste_attempts,0) > 2 THEN 1 END) as flagged_attempts,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)))::numeric / 60, 1) as avg_time_minutes
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            INNER JOIN students st ON qa.student_id = st.id AND (st.deleted_at IS NULL)
            INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId} ${offeringSt}
            WHERE qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              AND qa.completed_at >= NOW() - INTERVAL '30 days'
              ${dateSql}
            GROUP BY DATE(qa.completed_at)
            ORDER BY attempt_date DESC
          `

        const topPerformers = await sql`
            SELECT 
              s.full_name as student_name,
              s.section,
              COUNT(qa.id) as total_attempts,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as avg_percentage,
              MAX(qa.completed_at) as last_activity
            FROM students s
            INNER JOIN sessions sess_sc ON s.session_id = sess_sc.id AND sess_sc.course_id = ${platformCourseId} ${offeringS}
            JOIN quiz_attempts qa ON s.id = qa.student_id
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            WHERE (s.deleted_at IS NULL)
              AND qa.completed_at >= NOW() - INTERVAL '30 days'
            GROUP BY s.id, s.full_name, s.section
            HAVING COUNT(qa.id) >= 2
            ORDER BY avg_percentage DESC
            LIMIT 10
          `

        const strugglingStudents = await sql`
            SELECT 
              s.full_name as student_name,
              s.section,
              COUNT(qa.id) as total_attempts,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as avg_percentage,
              MAX(qa.completed_at) as last_activity
            FROM students s
            INNER JOIN sessions sess_sc ON s.session_id = sess_sc.id AND sess_sc.course_id = ${platformCourseId} ${offeringS}
            JOIN quiz_attempts qa ON s.id = qa.student_id
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND (qa.is_final_grade IS DISTINCT FROM false)
              ${dateSql}
            JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            WHERE (s.deleted_at IS NULL)
              AND qa.completed_at >= NOW() - INTERVAL '30 days'
            GROUP BY s.id, s.full_name, s.section
            HAVING COUNT(qa.id) >= 2
              AND AVG((qa.score::numeric / NULLIF((${sql.unsafe(SQL_QUIZ_MAX_POINTS)}), 0)) * 100) < 60
            ORDER BY avg_percentage ASC
            LIMIT 10
          `

        const bundle = {
          dailyActivity: learningData.map((day) => ({
            date: day.attempt_date,
            attempts: parseInt(String(day.daily_attempts), 10) || 0,
            activeStudents: parseInt(String(day.active_students), 10) || 0,
            avgScore: parseFloat(String(day.avg_score)) || 0,
            avgPercentage: parseFloat(String(day.avg_percentage)) || 0,
            flaggedAttempts: parseInt(String(day.flagged_attempts), 10) || 0,
            avgTimeMinutes: parseFloat(String(day.avg_time_minutes)) || 0,
            engagementLevel:
              parseInt(String(day.active_students), 10) > 20
                ? "High"
                : parseInt(String(day.active_students), 10) > 10
                  ? "Moderate"
                  : "Low",
          })),
          topPerformers: topPerformers.map((student) => ({
            studentName: student.student_name,
            section: student.section,
            attempts: parseInt(String(student.total_attempts), 10) || 0,
            avgPercentage: parseFloat(String(student.avg_percentage)) || 0,
            lastActivity: student.last_activity,
            performanceLevel:
              parseFloat(String(student.avg_percentage)) > 90
                ? "Outstanding"
                : "Excellent",
          })),
          strugglingStudents: strugglingStudents.map((student) => ({
            studentName: student.student_name,
            section: student.section,
            attempts: parseInt(String(student.total_attempts), 10) || 0,
            avgPercentage: parseFloat(String(student.avg_percentage)) || 0,
            lastActivity: student.last_activity,
            interventionNeeded:
              parseFloat(String(student.avg_percentage)) < 40
                ? "High Priority"
                : "Medium Priority",
          })),
          insights: {
            totalDaysAnalyzed: learningData.length,
            avgDailyAttempts:
              learningData.length > 0
                ? Math.round(
                    learningData.reduce(
                      (sum, day) =>
                        sum + (parseInt(String(day.daily_attempts), 10) || 0),
                      0,
                    ) / learningData.length,
                  )
                : 0,
            avgDailyActiveStudents:
              learningData.length > 0
                ? Math.round(
                    learningData.reduce(
                      (sum, day) =>
                        sum +
                        (parseInt(String(day.active_students), 10) || 0),
                      0,
                    ) / learningData.length,
                  )
                : 0,
            overallEngagement:
              learningData.length > 0
                ? "Active learning environment"
                : "Limited recent activity",
          },
        }
        extraMetadata = { learningAnalyticsBundle: bundle }
        reportData = flattenLearningAnalyticsForTables(bundle)
        break
      }

      case "performance-trends": {
        const trendsData = await sql`
            SELECT 
              DATE_TRUNC('week', qa.completed_at) as week,
              COUNT(DISTINCT qa.student_id) as unique_students,
              COUNT(qa.id) as total_attempts,
              ROUND(AVG((qa.score::numeric / NULLIF(${sql.unsafe(SQL_QUIZ_MAX_POINTS)}, 0)) * 100), 2) as avg_percentage,
              ROUND(AVG(EXTRACT(EPOCH FROM (qa.completed_at - qa.started_at)))::numeric / 60, 1) as avg_time_minutes,
              COUNT(CASE WHEN COALESCE(qa.tab_switch_count,0) > 3 THEN 1 END) as high_tab_switches,
              COUNT(CASE WHEN COALESCE(qa.copy_paste_attempts,0) > 2 THEN 1 END) as high_copy_paste
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
            INNER JOIN students st ON qa.student_id = st.id AND (st.deleted_at IS NULL)
            INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId} ${offeringSt}
            WHERE (qa.is_final_grade IS DISTINCT FROM false)
              AND qa.completed_at IS NOT NULL
              AND qa.deleted_at IS NULL
              AND qa.completed_at > NOW() - INTERVAL '12 weeks'
              ${dateSql}
            GROUP BY DATE_TRUNC('week', qa.completed_at)
            ORDER BY week DESC
            LIMIT 12
          `
        reportData = trendsData.map((week) => ({
          week:
            week.week != null
              ? new Date(week.week as string).toISOString().slice(0, 10)
              : "N/A",
          uniqueStudents: parseInt(String(week.unique_students), 10) || 0,
          totalAttempts: parseInt(String(week.total_attempts), 10) || 0,
          avgPercentage: parseFloat(String(week.avg_percentage)) || 0,
          avgTimeMinutes: parseFloat(String(week.avg_time_minutes)) || 0,
          highTabSwitches: parseInt(String(week.high_tab_switches), 10) || 0,
          highCopyPaste: parseInt(String(week.high_copy_paste), 10) || 0,
          trend: "stable",
        }))
        break
      }

      default:
        return NextResponse.json(
          { error: "Invalid report type" },
          { status: 400 },
        )
    }

    return NextResponse.json({
      reportType,
      format,
      data: reportData,
      metadata:
        Object.keys(extraMetadata).length > 0 ? extraMetadata : undefined,
      generatedAt: new Date().toISOString(),
      success: true,
    })
  } catch (error) {
    console.error("Error generating custom report:", error)
    return NextResponse.json(
      { error: "Failed to generate custom report" },
      { status: 500 },
    )
  }
}
