import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

function periodStartDate(period: string, now: Date): Date {
  switch (period) {
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case "90d":
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case "1y":
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    case "30d":
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }
}

function sanitizeData(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeData(item))
  }
  if (data !== null && typeof data === "object") {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (typeof value === "bigint") {
        sanitized[key] = Number(value)
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString().slice(0, 10)
      } else if (value !== null && typeof value === "object") {
        sanitized[key] = sanitizeData(value)
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }
  return data
}

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const platformCourseId = scope.course.id
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "30d"
    const assessmentType = searchParams.get("assessmentType") || "all"

    const now = new Date()
    const startDate = periodStartDate(period, now)
    const startIso = startDate.toISOString()
    const typeParam = assessmentType !== "all" && assessmentType.trim() ? assessmentType : null

    const safeQuery = async (name: string, queryFn: () => Promise<unknown>, defaultValue: unknown = []) => {
      try {
        return await queryFn()
      } catch (error) {
        console.error(`[Advanced Analytics] Error fetching ${name}:`, error)
        return defaultValue
      }
    }

    const overview = await safeQuery(
      "overview",
      async () => {
        const [studentsRow, attemptsRow, assessmentsRow, avgRow, completedRow, incompleteRow] =
          await Promise.all([
            sql`
              SELECT COUNT(*)::bigint AS c
              FROM students st
              WHERE st.course_id = ${platformCourseId}
                OR EXISTS (
                  SELECT 1 FROM sessions sess
                  WHERE sess.id = st.session_id AND sess.course_id = ${platformCourseId}
                )
            `,
            sql`
              SELECT COUNT(*)::bigint AS c
              FROM quiz_attempts qa
              INNER JOIN students st ON qa.student_id = st.id
              INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
              INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
              WHERE qa.deleted_at IS NULL
                AND (
                  q.course_id = ${platformCourseId}
                  OR EXISTS (
                    SELECT 1 FROM quiz_session_access qsa
                    INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                    WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
                  )
                )
                AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
                AND (
                  qa.completed_at >= ${startIso}::timestamptz
                  OR qa.started_at >= ${startIso}::timestamptz
                )
            `,
            sql`
              SELECT COUNT(DISTINCT q.id)::bigint AS c
              FROM quizzes q
              INNER JOIN quiz_attempts qa ON qa.quiz_id = q.id AND qa.deleted_at IS NULL
              INNER JOIN students st ON qa.student_id = st.id
              INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
              WHERE q.deleted_at IS NULL
                AND (
                  q.course_id = ${platformCourseId}
                  OR EXISTS (
                    SELECT 1 FROM quiz_session_access qsa
                    INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                    WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
                  )
                )
                AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
                AND (
                  qa.completed_at >= ${startIso}::timestamptz
                  OR qa.started_at >= ${startIso}::timestamptz
                )
            `,
            sql`
              SELECT COALESCE(AVG(qa.score), 0)::numeric AS c
              FROM quiz_attempts qa
              INNER JOIN students st ON qa.student_id = st.id
              INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
              INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
              WHERE qa.deleted_at IS NULL
                AND qa.score IS NOT NULL
                AND (
                  q.course_id = ${platformCourseId}
                  OR EXISTS (
                    SELECT 1 FROM quiz_session_access qsa
                    INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                    WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
                  )
                )
                AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
                AND (
                  qa.completed_at >= ${startIso}::timestamptz
                  OR qa.started_at >= ${startIso}::timestamptz
                )
            `,
            sql`
              SELECT COUNT(*)::bigint AS c
              FROM quiz_attempts qa
              INNER JOIN students st ON qa.student_id = st.id
              INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
              INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
              WHERE qa.deleted_at IS NULL
                AND qa.completed_at IS NOT NULL
                AND (
                  q.course_id = ${platformCourseId}
                  OR EXISTS (
                    SELECT 1 FROM quiz_session_access qsa
                    INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                    WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
                  )
                )
                AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
                AND (
                  qa.completed_at >= ${startIso}::timestamptz
                  OR qa.started_at >= ${startIso}::timestamptz
                )
            `,
            sql`
              SELECT COUNT(*)::bigint AS c
              FROM quiz_attempts qa
              INNER JOIN students st ON qa.student_id = st.id
              INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
              INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
              WHERE qa.deleted_at IS NULL
                AND qa.completed_at IS NULL
                AND (
                  q.course_id = ${platformCourseId}
                  OR EXISTS (
                    SELECT 1 FROM quiz_session_access qsa
                    INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                    WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
                  )
                )
                AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
                AND (
                  qa.completed_at >= ${startIso}::timestamptz
                  OR qa.started_at >= ${startIso}::timestamptz
                )
            `,
          ])

        return {
          total_students: studentsRow[0]?.c ?? 0,
          total_assessments: assessmentsRow[0]?.c ?? 0,
          total_attempts: attemptsRow[0]?.c ?? 0,
          average_score: avgRow[0]?.c ?? 0,
          completed_attempts: completedRow[0]?.c ?? 0,
          incomplete_attempts: incompleteRow[0]?.c ?? 0,
        }
      },
      {
        total_students: 0,
        total_assessments: 0,
        total_attempts: 0,
        average_score: 0,
        completed_attempts: 0,
        incomplete_attempts: 0,
      },
    )

    const assessmentTypePerformance = await safeQuery("assessmentTypePerformance", async () =>
      sql`
        SELECT 
          COALESCE(q.assessment_type, 'quiz') AS type,
          COUNT(qa.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COALESCE(MIN(qa.score), 0) AS min_score,
          COALESCE(MAX(qa.score), 0) AS max_score,
          COUNT(DISTINCT q.id) AS total_assessments
        FROM quiz_attempts qa
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY q.assessment_type
        ORDER BY attempts DESC
      `,
    )

    const sessionPerformance = await safeQuery("sessionPerformance", async () =>
      sql`
        SELECT 
          COALESCE(sess.code, 'Unknown') AS session_code,
          'Session ' || COALESCE(sess.code, 'Unknown') AS session_name,
          COUNT(qa.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COUNT(DISTINCT q.id) AS total_assessments
        FROM quiz_attempts qa
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY sess.code
        ORDER BY attempts DESC
      `,
    )

    const topicPerformance = await safeQuery("topicPerformance", async () =>
      sql`
        SELECT 
          COALESCE(NULLIF(TRIM(q.topic), ''), 'General') AS topic,
          COUNT(qa.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COUNT(DISTINCT q.id) AS total_assessments
        FROM quiz_attempts qa
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY COALESCE(NULLIF(TRIM(q.topic), ''), 'General')
        ORDER BY attempts DESC
        LIMIT 30
      `,
    )

    const questionTypePerformance = await safeQuery("questionTypePerformance", async () =>
      sql`
        SELECT 
          qq.question_type,
          COUNT(qans.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(
            AVG(
              CASE
                WHEN qans.is_correct = true THEN 100
                WHEN qans.points_earned IS NOT NULL AND COALESCE(qq.max_points, qq.points, 0) > 0
                  THEN (qans.points_earned::numeric / COALESCE(qq.max_points, qq.points, 1)::numeric) * 100
                ELSE 0
              END
            ),
            0
          ) AS avg_score,
          COUNT(DISTINCT q.id) AS total_assessments
        FROM quiz_answers qans
        INNER JOIN quiz_questions qq ON qans.question_id = qq.id
        INNER JOIN quiz_attempts qa ON qans.attempt_id = qa.id AND qa.deleted_at IS NULL
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qq.question_type IS NOT NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY qq.question_type
        ORDER BY attempts DESC
        LIMIT 30
      `,
    )

    const difficultyAnalysis = await safeQuery("difficultyAnalysis", async () =>
      sql`
        SELECT 
          COALESCE(NULLIF(TRIM(qq.difficulty), ''), 'unknown') AS difficulty,
          COUNT(qans.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(
            AVG(
              CASE
                WHEN qans.is_correct = true THEN 100
                WHEN qans.points_earned IS NOT NULL AND COALESCE(qq.max_points, qq.points, 0) > 0
                  THEN (qans.points_earned::numeric / COALESCE(qq.max_points, qq.points, 1)::numeric) * 100
                ELSE 0
              END
            ),
            0
          ) AS avg_score,
          COUNT(DISTINCT q.id) AS total_assessments
        FROM quiz_answers qans
        INNER JOIN quiz_questions qq ON qans.question_id = qq.id
        INNER JOIN quiz_attempts qa ON qans.attempt_id = qa.id AND qa.deleted_at IS NULL
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY COALESCE(NULLIF(TRIM(qq.difficulty), ''), 'unknown')
        ORDER BY attempts DESC
      `,
    )

    const topStudents = await safeQuery("topStudents", async () =>
      sql`
        SELECT 
          s.id,
          TRIM(split_part(COALESCE(s.full_name, ''), ' ', 1)) AS first_name,
          NULLIF(
            TRIM(substring(COALESCE(s.full_name, '') FROM length(trim(split_part(COALESCE(s.full_name, ''), ' ', 1))) + 2)),
            ''
          ) AS last_name,
          sess.code AS session_code,
          COUNT(qa.id) AS total_attempts,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COALESCE(MAX(qa.score), 0) AS highest_score,
          COUNT(DISTINCT q.id) AS assessments_taken
        FROM students s
        INNER JOIN sessions sess ON s.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quiz_attempts qa ON s.id = qa.student_id AND qa.deleted_at IS NULL
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY s.id, s.full_name, sess.code
        HAVING COUNT(qa.id) > 0
        ORDER BY avg_score DESC
        LIMIT 20
      `,
    )

    const strugglingStudents = await safeQuery("strugglingStudents", async () =>
      sql`
        SELECT 
          s.id,
          TRIM(split_part(COALESCE(s.full_name, ''), ' ', 1)) AS first_name,
          NULLIF(
            TRIM(substring(COALESCE(s.full_name, '') FROM length(trim(split_part(COALESCE(s.full_name, ''), ' ', 1))) + 2)),
            ''
          ) AS last_name,
          sess.code AS session_code,
          COUNT(qa.id) AS total_attempts,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COALESCE(MIN(qa.score), 0) AS lowest_score,
          COUNT(DISTINCT q.id) AS assessments_taken
        FROM students s
        INNER JOIN sessions sess ON s.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quiz_attempts qa ON s.id = qa.student_id AND qa.deleted_at IS NULL
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY s.id, s.full_name, sess.code
        HAVING AVG(qa.score) < 60 AND COUNT(qa.id) > 0
        ORDER BY avg_score ASC
        LIMIT 20
      `,
    )

    const assessmentDetails = await safeQuery("assessmentDetails", async () =>
      sql`
        SELECT 
          q.id,
          q.title,
          COALESCE(q.assessment_type, 'quiz') AS assessment_type,
          COUNT(qa.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(AVG(qa.score), 0) AS avg_score,
          COALESCE(MIN(qa.score), 0) AS min_score,
          COALESCE(MAX(qa.score), 0) AS max_score,
          COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) AS completed,
          COUNT(CASE WHEN qa.completed_at IS NULL THEN 1 END) AS incomplete
        FROM quizzes q
        INNER JOIN quiz_attempts qa ON q.id = qa.quiz_id AND qa.deleted_at IS NULL
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        WHERE q.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY q.id, q.title, q.assessment_type
        HAVING COUNT(qa.id) > 0
        ORDER BY attempts DESC
        LIMIT 50
      `,
    )

    const completionRates = await safeQuery("completionRates", async () =>
      sql`
        SELECT 
          COALESCE(q.assessment_type, 'quiz') AS assessment_type,
          COUNT(qa.id) AS total_attempts,
          COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) AS completed_attempts,
          ROUND(
            COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(qa.id), 0), 
            2
          ) AS completion_rate
        FROM quiz_attempts qa
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (
            qa.completed_at >= ${startIso}::timestamptz
            OR qa.started_at >= ${startIso}::timestamptz
          )
        GROUP BY q.assessment_type
        ORDER BY completion_rate DESC
      `,
    )

    const dailyTrends = await safeQuery("dailyTrends", async () =>
      sql`
        SELECT 
          DATE(COALESCE(qa.completed_at, qa.started_at)) AS date,
          COUNT(qa.id) AS attempts,
          COUNT(DISTINCT qa.student_id) AS unique_students,
          COALESCE(AVG(qa.score), 0) AS avg_score
        FROM quiz_attempts qa
        INNER JOIN students st ON qa.student_id = st.id
        INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
        INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
        WHERE qa.deleted_at IS NULL
          AND (
            q.course_id = ${platformCourseId}
            OR EXISTS (
              SELECT 1 FROM quiz_session_access qsa
              INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
              WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
            )
          )
          AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
          AND (qa.completed_at >= ${startIso}::timestamptz OR qa.started_at >= ${startIso}::timestamptz)
        GROUP BY DATE(COALESCE(qa.completed_at, qa.started_at))
        ORDER BY date ASC
        LIMIT 30
      `,
    )

    const aiTutorStats = await safeQuery(
      "aiTutorStats",
      async () => {
        const rows = await sql`
          SELECT 
            COUNT(aic.id)::bigint AS total_conversations,
            COUNT(DISTINCT aic.student_id)::bigint AS unique_students,
            COALESCE(AVG(aic.satisfaction_score), 0)::numeric AS avg_rating
          FROM ai_tutor_conversations aic
          INNER JOIN students st ON aic.student_id = st.id
          INNER JOIN sessions sess ON st.session_id = sess.id AND sess.course_id = ${platformCourseId}
          WHERE aic.created_at >= ${startIso}::timestamptz
        `
        return rows[0] ?? { total_conversations: 0, unique_students: 0, avg_rating: 0 }
      },
      { total_conversations: 0, unique_students: 0, avg_rating: 0 },
    )

    const practiceStats = await safeQuery(
      "practiceStats",
      async () => {
        const rows = await sql`
          SELECT 
            COUNT(pa.id)::bigint AS total_attempts,
            COUNT(DISTINCT pa.student_id)::bigint AS unique_students,
            COALESCE(AVG(CAST(pa.score_percentage AS NUMERIC)), 0)::numeric AS avg_score,
            COUNT(CASE WHEN pa.score_percentage >= 70 THEN 1 END)::bigint AS passed_attempts
          FROM practice_attempts pa
          INNER JOIN students st ON st.id = pa.student_id
          INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
          WHERE pa.completed_at IS NOT NULL
            AND pa.completed_at >= ${startIso}::timestamptz
        `
        return rows[0] ?? {
          total_attempts: 0,
          unique_students: 0,
          avg_score: 0,
          passed_attempts: 0,
        }
      },
      { total_attempts: 0, unique_students: 0, avg_score: 0, passed_attempts: 0 },
    )

    const performanceSummary = await safeQuery(
      "performanceSummary",
      async () => {
        const rows = await sql`
          SELECT
            COUNT(DISTINCT qa.student_id)::bigint AS unique_learners,
            ROUND(
              COUNT(*) FILTER (WHERE qa.score >= 70) * 100.0 / NULLIF(COUNT(*), 0),
              1
            ) AS pass_rate,
            COALESCE(MIN(qa.score), 0)::numeric AS min_score,
            COALESCE(MAX(qa.score), 0)::numeric AS max_score,
            COALESCE(
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY qa.score),
              0
            )::numeric AS median_score
          FROM quiz_attempts qa
          INNER JOIN students st ON qa.student_id = st.id
          INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
          INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
          WHERE qa.deleted_at IS NULL
            AND qa.score IS NOT NULL
            AND qa.completed_at IS NOT NULL
            AND (
              q.course_id = ${platformCourseId}
              OR EXISTS (
                SELECT 1 FROM quiz_session_access qsa
                INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
              )
            )
            AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
            AND (
              qa.completed_at >= ${startIso}::timestamptz
              OR qa.started_at >= ${startIso}::timestamptz
            )
        `
        return rows[0] ?? {
          unique_learners: 0,
          pass_rate: 0,
          min_score: 0,
          max_score: 0,
          median_score: 0,
        }
      },
      { unique_learners: 0, pass_rate: 0, min_score: 0, max_score: 0, median_score: 0 },
    )

    const scoreDistribution = await safeQuery("scoreDistribution", async () =>
      sql`
        WITH buckets AS (
          SELECT
            CASE
              WHEN qa.score >= 90 THEN '90–100%'
              WHEN qa.score >= 80 THEN '80–89%'
              WHEN qa.score >= 70 THEN '70–79%'
              WHEN qa.score >= 60 THEN '60–69%'
              WHEN qa.score >= 50 THEN '50–59%'
              ELSE 'Below 50%'
            END AS range_label,
            CASE
              WHEN qa.score >= 90 THEN 6
              WHEN qa.score >= 80 THEN 5
              WHEN qa.score >= 70 THEN 4
              WHEN qa.score >= 60 THEN 3
              WHEN qa.score >= 50 THEN 2
              ELSE 1
            END AS sort_order
          FROM quiz_attempts qa
          INNER JOIN students st ON qa.student_id = st.id
          INNER JOIN sessions sess ON sess.id = st.session_id AND sess.course_id = ${platformCourseId}
          INNER JOIN quizzes q ON qa.quiz_id = q.id AND q.deleted_at IS NULL
          WHERE qa.deleted_at IS NULL
            AND qa.score IS NOT NULL
            AND qa.completed_at IS NOT NULL
            AND (
              q.course_id = ${platformCourseId}
              OR EXISTS (
                SELECT 1 FROM quiz_session_access qsa
                INNER JOIN sessions sess2 ON sess2.id = qsa.session_id
                WHERE qsa.quiz_id = q.id AND sess2.course_id = ${platformCourseId}
              )
            )
            AND (${typeParam}::text IS NULL OR COALESCE(q.assessment_type, 'quiz') = ${typeParam})
            AND (
              qa.completed_at >= ${startIso}::timestamptz
              OR qa.started_at >= ${startIso}::timestamptz
            )
        )
        SELECT range_label AS range, COUNT(*)::int AS count, MIN(sort_order) AS sort_order
        FROM buckets
        GROUP BY range_label
        ORDER BY sort_order ASC
      `,
    )

    const responseData = {
      success: true,
      period,
      assessmentType,
      dateRange: {
        start: startIso,
        end: now.toISOString(),
      },
      overview: sanitizeData(overview),
      assessmentTypePerformance: sanitizeData(assessmentTypePerformance),
      sessionPerformance: sanitizeData(sessionPerformance),
      topicPerformance: sanitizeData(topicPerformance),
      questionTypePerformance: sanitizeData(questionTypePerformance),
      difficultyAnalysis: sanitizeData(difficultyAnalysis),
      dailyTrends: sanitizeData(dailyTrends),
      topStudents: sanitizeData(topStudents),
      strugglingStudents: sanitizeData(strugglingStudents),
      assessmentDetails: sanitizeData(assessmentDetails),
      completionRates: sanitizeData(completionRates),
      aiTutorStats: sanitizeData(aiTutorStats),
      practiceStats: sanitizeData(practiceStats),
      performanceSummary: sanitizeData(performanceSummary),
      scoreDistribution: sanitizeData(scoreDistribution),
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("[Advanced Analytics] Fatal error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch advanced analytics data",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
