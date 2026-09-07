import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDashboardV2Path } from "@/lib/student-v2-routes"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    const studentIdNum = parseInt(studentId, 10)
    if (!Number.isFinite(studentIdNum)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    const courseCtx = await resolveStudentCourseContextByDbId(studentIdNum)
    const courseId = courseCtx?.courseId ?? null

    let recentQuizzes: Array<{ title: string; score: number; completed_at: string }> = []
    let recentHomeworks: Array<{ title: string; score: number; completed_at: string }> = []
    let upcomingExams: Array<{ title: string; available_from: string; available_until: string }> = []
    let recentLectures: Array<{ title: string; created_at: string; week: number | null }> = []

    try {
      recentQuizzes = courseId
        ? await sql`
            SELECT q.title, qa.score, qa.completed_at
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.student_id = ${studentIdNum}
              AND q.assessment_type = 'quiz'
              AND q.deleted_at IS NULL
              AND q.course_id = ${courseId}
            ORDER BY qa.completed_at DESC
            LIMIT 5
          `
        : await sql`
            SELECT q.title, qa.score, qa.completed_at
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.student_id = ${studentIdNum}
              AND q.assessment_type = 'quiz'
              AND q.deleted_at IS NULL
            ORDER BY qa.completed_at DESC
            LIMIT 5
          `
    } catch (error: unknown) {
      console.error("[AI Tutor Recommendations] Error fetching quizzes:", error)
    }

    try {
      recentHomeworks = courseId
        ? await sql`
            SELECT q.title, qa.score, qa.completed_at
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.student_id = ${studentIdNum}
              AND q.assessment_type = 'homework'
              AND q.deleted_at IS NULL
              AND q.course_id = ${courseId}
            ORDER BY qa.completed_at DESC
            LIMIT 3
          `
        : await sql`
            SELECT q.title, qa.score, qa.completed_at
            FROM quiz_attempts qa
            JOIN quizzes q ON qa.quiz_id = q.id
            WHERE qa.student_id = ${studentIdNum}
              AND q.assessment_type = 'homework'
              AND q.deleted_at IS NULL
            ORDER BY qa.completed_at DESC
            LIMIT 3
          `
    } catch (error: unknown) {
      console.error("[AI Tutor Recommendations] Error fetching homeworks:", error)
    }

    try {
      upcomingExams = courseId
        ? await sql`
            SELECT q.title, q.available_from, q.available_until
            FROM quizzes q
            WHERE q.assessment_type IN ('mid_semester', 'finals')
              AND q.deleted_at IS NULL
              AND q.available_from <= CURRENT_TIMESTAMP
              AND q.available_until >= CURRENT_TIMESTAMP
              AND q.course_id = ${courseId}
            ORDER BY q.available_until ASC
            LIMIT 2
          `
        : await sql`
            SELECT q.title, q.available_from, q.available_until
            FROM quizzes q
            WHERE q.assessment_type IN ('mid_semester', 'finals')
              AND q.deleted_at IS NULL
              AND q.available_from <= CURRENT_TIMESTAMP
              AND q.available_until >= CURRENT_TIMESTAMP
            ORDER BY q.available_until ASC
            LIMIT 2
          `
    } catch (error: unknown) {
      console.error("[AI Tutor Recommendations] Error fetching exams:", error)
    }

    try {
      recentLectures = courseId
        ? await sql`
            SELECT l.title, l.created_at, l.week
            FROM lectures l
            WHERE l.deleted_at IS NULL
              AND (l.course_id IS NULL OR l.course_id = ${courseId})
              AND (
                l.session IS NULL
                OR l.session = (SELECT section FROM students WHERE id = ${studentIdNum})
              )
            ORDER BY l.created_at DESC
            LIMIT 3
          `
        : await sql`
            SELECT l.title, l.created_at, l.week
            FROM lectures l
            WHERE l.deleted_at IS NULL
              AND (
                l.session IS NULL
                OR l.session = (SELECT section FROM students WHERE id = ${studentIdNum})
              )
            ORDER BY l.created_at DESC
            LIMIT 3
          `
    } catch (error: unknown) {
      console.error("[AI Tutor Recommendations] Error fetching lectures:", error)
    }

    const recommendations: Array<{
      id: string
      type: string
      title: string
      description: string
      priority: string
      estimatedTime: number
      difficulty: string
      link: string
    }> = []

    if (recentQuizzes.length > 0) {
      const avgQuizScore = recentQuizzes.reduce((sum, q) => sum + q.score, 0) / recentQuizzes.length
      if (avgQuizScore < 70) {
        recommendations.push({
          id: `quiz-practice-${Date.now()}`,
          type: "quiz",
          title: "Practice quiz questions",
          description:
            "Your recent quiz scores suggest more practice — try guided review in Practice Hub.",
          priority: "high",
          estimatedTime: 30,
          difficulty: "intermediate",
          link: resolveStudentDashboardV2Path("/student/dashboard-v2/practice"),
        })
      }
    }

    if (recentHomeworks.length > 0) {
      const avgHomeworkScore =
        recentHomeworks.reduce((sum, h) => sum + h.score, 0) / recentHomeworks.length
      if (avgHomeworkScore < 75) {
        recommendations.push({
          id: `homework-review-${Date.now()}`,
          type: "homework",
          title: "Review homework concepts",
          description: "Focus on missed homework ideas with Cora before the next assignment.",
          priority: "high",
          estimatedTime: 45,
          difficulty: "intermediate",
          link: resolveStudentDashboardV2Path("/student/dashboard-v2/homework"),
        })
      }
    }

    for (const exam of upcomingExams) {
      recommendations.push({
        id: `exam-prep-${exam.title}`,
        type: "exam",
        title: `Prepare for ${exam.title}`,
        description: `Upcoming exam on ${new Date(exam.available_until).toLocaleDateString()}. Start a focused review with Cora.`,
        priority: "high",
        estimatedTime: 60,
        difficulty: "advanced",
        link: resolveStudentDashboardV2Path("/student/dashboard-v2/quizzes"),
      })
    }

    for (const lecture of recentLectures) {
      recommendations.push({
        id: `lecture-review-${lecture.title}`,
        type: "lecture",
        title: `Review: ${lecture.title}`,
        description: "Recent lecture material — summarize slides and ask Cora to clarify gaps.",
        priority: "medium",
        estimatedTime: 20,
        difficulty: "beginner",
        link: resolveStudentDashboardV2Path("/student/dashboard-v2/lectures"),
      })
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error("[v0] Failed to fetch recommendations:", error)
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 })
  }
}
