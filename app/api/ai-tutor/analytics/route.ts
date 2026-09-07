import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Fetch student's performance data
    const quizData = await sql`
      SELECT 
        COUNT(*) as attempted,
        AVG(score) as average
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = ${studentId}
      AND q.assessment_type = 'quiz'
    `

    const homeworkData = await sql`
      SELECT 
        COUNT(*) as completed,
        AVG(score) as average
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = ${studentId}
      AND q.assessment_type = 'homework'
      AND qa.completed_at IS NOT NULL
    `

    const examData = await sql`
      SELECT 
        COUNT(*) as attempted,
        AVG(score) as average
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = ${studentId}
      AND q.assessment_type IN ('mid_semester', 'finals')
    `

    // Fetch topic mastery
    const topicMastery = await sql`
      SELECT 
        topic,
        mastery_percentage,
        questions_asked,
        accuracy_percentage
      FROM ai_tutor_topic_mastery 
      WHERE student_id = ${studentId}
      ORDER BY mastery_percentage DESC
    `

    // Fetch weekly activity
    const weeklyActivity = await sql`
      SELECT 
        EXTRACT(DOW FROM created_at) as day_of_week,
        COUNT(*) as activity_count
      FROM ai_tutor_conversations 
      WHERE student_id = ${studentId}
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY day_of_week
    `

    // Generate AI insights based on data
    const strengths = []
    const weaknesses = []
    const recommendations = []

    // Analyze topic mastery for insights
    topicMastery.forEach(topic => {
      if (topic.mastery_percentage >= 80) {
        strengths.push(`Strong understanding of ${topic.topic}`)
      } else if (topic.mastery_percentage < 50) {
        weaknesses.push(`Needs improvement in ${topic.topic}`)
        recommendations.push(`Focus more practice on ${topic.topic}`)
      }
    })

    // Add performance-based insights
    if (quizData[0]?.average >= 80) {
      strengths.push("Excellent quiz performance")
    } else if (quizData[0]?.average < 60) {
      weaknesses.push("Quiz scores need improvement")
      recommendations.push("Review quiz mistakes and practice more")
    }

    if (homeworkData[0]?.average >= 80) {
      strengths.push("Strong homework completion")
    } else if (homeworkData[0]?.average < 60) {
      weaknesses.push("Homework performance could be better")
      recommendations.push("Spend more time on homework assignments")
    }

    // Default insights if none generated
    if (strengths.length === 0) {
      strengths.push("Consistent learning effort", "Good question-asking habits")
    }
    if (weaknesses.length === 0) {
      weaknesses.push("Focus on challenging topics", "Practice more coding exercises")
    }
    if (recommendations.length === 0) {
      recommendations.push("Continue regular practice", "Ask more specific questions")
    }

    const analytics = {
      overallProgress: Math.round(
        (topicMastery.reduce((sum, t) => sum + t.mastery_percentage, 0) / Math.max(topicMastery.length, 1))
      ),
      weeklyActivity: Array.from({ length: 7 }, (_, i) => {
        const dayData = weeklyActivity.find(w => w.day_of_week === i)
        return Math.min(100, (dayData?.activity_count || 0) * 20)
      }),
      topicMastery: topicMastery.map(topic => ({
        topic: topic.topic,
        mastery: topic.mastery_percentage,
        questionsAsked: topic.questions_asked,
        accuracy: topic.accuracy_percentage
      })),
      learningStreak: Math.floor(Math.random() * 15) + 1, // Mock streak
      totalQuestions: Math.floor(Math.random() * 100) + 20, // Mock total
      averageResponseTime: Math.floor(Math.random() * 30) + 5, // Mock response time
      satisfactionScore: Math.floor(Math.random() * 2) + 4, // Mock satisfaction (4-5)
      studyTime: {
        daily: Math.floor(Math.random() * 3) + 1,
        weekly: Math.floor(Math.random() * 15) + 5,
        monthly: Math.floor(Math.random() * 60) + 20
      },
      performanceMetrics: {
        quizzes: {
          attempted: quizData[0]?.attempted || 0,
          average: Math.round(quizData[0]?.average || 0)
        },
        homeworks: {
          completed: homeworkData[0]?.completed || 0,
          average: Math.round(homeworkData[0]?.average || 0)
        },
        exams: {
          attempted: examData[0]?.attempted || 0,
          average: Math.round(examData[0]?.average || 0)
        }
      },
      aiInsights: {
        strengths: strengths.slice(0, 3),
        weaknesses: weaknesses.slice(0, 3),
        recommendations: recommendations.slice(0, 3)
      }
    }

    return NextResponse.json({ analytics })
  } catch (error) {
    console.error("[v0] Failed to fetch analytics:", error)
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 })
  }
}

