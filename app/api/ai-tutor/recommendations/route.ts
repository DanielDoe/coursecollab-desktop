import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveStudentDashboardV2Path } from "@/lib/student-v2-routes"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Convert studentId to number if needed
    const studentIdNum = parseInt(studentId)

    // Initialize arrays with error handling
    let recentQuizzes: any[] = []
    let recentHomeworks: any[] = []
    let upcomingExams: any[] = []
    let recentLectures: any[] = []

    // Fetch student's recent performance and generate recommendations
    try {
      recentQuizzes = await sql`
        SELECT 
          q.title,
          qa.score,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ${studentIdNum}
        AND q.assessment_type = 'quiz'
        ORDER BY qa.completed_at DESC
        LIMIT 5
      `
    } catch (error: any) {
      console.error("[AI Tutor Recommendations] Error fetching quizzes:", error)
      recentQuizzes = []
    }

    try {
      recentHomeworks = await sql`
        SELECT 
          q.title,
          qa.score,
          qa.completed_at
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.id
        WHERE qa.student_id = ${studentIdNum}
        AND q.assessment_type = 'homework'
        ORDER BY qa.completed_at DESC
        LIMIT 3
      `
    } catch (error: any) {
      console.error("[AI Tutor Recommendations] Error fetching homeworks:", error)
      recentHomeworks = []
    }

    try {
      upcomingExams = await sql`
        SELECT 
          q.title,
          q.available_from,
          q.available_until
        FROM quizzes q
        WHERE q.assessment_type IN ('mid_semester', 'finals')
        AND q.available_from <= CURRENT_TIMESTAMP
        AND q.available_until >= CURRENT_TIMESTAMP
        ORDER BY q.available_until ASC
        LIMIT 2
      `
    } catch (error: any) {
      console.error("[AI Tutor Recommendations] Error fetching exams:", error)
      upcomingExams = []
    }

    try {
      recentLectures = await sql`
        SELECT 
          l.title,
          l.created_at,
          l.week
        FROM lectures l
        WHERE l.session IS NULL 
          OR l.session = (SELECT section FROM students WHERE id = ${studentIdNum})
        ORDER BY l.created_at DESC
        LIMIT 3
      `
    } catch (error: any) {
      console.error("[AI Tutor Recommendations] Error fetching lectures:", error)
      recentLectures = []
    }

    // Generate AI recommendations based on performance
    const recommendations = []

    // Quiz recommendations
    if (recentQuizzes.length > 0) {
      const avgQuizScore = recentQuizzes.reduce((sum, q) => sum + q.score, 0) / recentQuizzes.length
      if (avgQuizScore < 70) {
        recommendations.push({
          id: `quiz-practice-${Date.now()}`,
          type: 'quiz',
          title: 'Practice Quiz Questions',
          description: 'Your recent quiz scores suggest you need more practice. Try some additional quiz questions to improve your understanding.',
          priority: 'high',
          estimatedTime: 30,
          difficulty: 'intermediate',
          link: resolveStudentDashboardV2Path('/student/quizzes')
        })
      }
    }

    // Homework recommendations
    if (recentHomeworks.length > 0) {
      const avgHomeworkScore = recentHomeworks.reduce((sum, h) => sum + h.score, 0) / recentHomeworks.length
      if (avgHomeworkScore < 75) {
        recommendations.push({
          id: `homework-review-${Date.now()}`,
          type: 'homework',
          title: 'Review Homework Concepts',
          description: 'Focus on understanding the concepts from recent homework assignments to improve your performance.',
          priority: 'high',
          estimatedTime: 45,
          difficulty: 'intermediate',
          link: resolveStudentDashboardV2Path('/student/homework')
        })
      }
    }

    // Exam preparation recommendations
    if (upcomingExams.length > 0) {
      upcomingExams.forEach(exam => {
        recommendations.push({
          id: `exam-prep-${exam.title}`,
          type: 'exam',
          title: `Prepare for ${exam.title}`,
          description: `Upcoming exam on ${new Date(exam.available_until).toLocaleDateString()}. Start reviewing key concepts and practice problems.`,
          priority: 'high',
          estimatedTime: 60,
          difficulty: exam.difficulty_level || 'advanced',
          link: resolveStudentDashboardV2Path('/student/finals')
        })
      })
    }

    // Lecture recommendations
    if (recentLectures.length > 0) {
      recentLectures.forEach(lecture => {
        recommendations.push({
          id: `lecture-review-${lecture.title}`,
          type: 'lecture',
          title: `Review: ${lecture.title}`,
          description: `Recent lecture covering important concepts. Review the material and ask questions if needed.`,
          priority: 'medium',
          estimatedTime: 20,
          difficulty: lecture.difficulty_level || 'beginner',
          link: resolveStudentDashboardV2Path('/student/lectures')
        })
      })
    }

    // Practice recommendations
    recommendations.push({
      id: `code-practice-${Date.now()}`,
      type: 'practice',
      title: 'Code Practice Session',
      description: 'Practice coding with AI-generated exercises tailored to your current level.',
      priority: 'medium',
      estimatedTime: 25,
      difficulty: 'intermediate',
      link: resolveStudentDashboardV2Path('/student/codebench')
    })

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push(
        {
          id: `general-practice-${Date.now()}`,
          type: 'quiz',
          title: 'General Practice Quiz',
          description: 'Take a practice quiz to test your current knowledge.',
          priority: 'medium',
          estimatedTime: 20,
          difficulty: 'intermediate',
          link: resolveStudentDashboardV2Path('/student/quizzes')
        },
        {
          id: `lecture-review-${Date.now()}`,
          type: 'lecture',
          title: 'Review Recent Lectures',
          description: 'Go through recent lecture materials to reinforce your understanding.',
          priority: 'low',
          estimatedTime: 15,
          difficulty: 'beginner',
          link: resolveStudentDashboardV2Path('/student/lectures')
        }
      )
    }

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error("[v0] Failed to fetch recommendations:", error)
    return NextResponse.json({ error: "Failed to fetch recommendations" }, { status: 500 })
  }
}

