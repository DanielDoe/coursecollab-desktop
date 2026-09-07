import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID required" }, { status: 400 })
    }

    // Get student info
    const studentInfo = await sql`
      SELECT id, full_name, student_id
      FROM students
      WHERE id = ${studentId}
    `

    if (studentInfo.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Build comprehensive learning path
    const events: any[] = []

    // 1. Lecture views
    const lectureViews = await sql`
      SELECT 
        lv.created_at,
        l.title as lecture_title,
        l.week,
        'lecture_view' as type
      FROM lecture_views lv
      JOIN lectures l ON lv.lecture_id = l.id
      WHERE lv.student_id = ${studentId}
        AND lv.created_at >= NOW() - INTERVAL '60 days'
      ORDER BY lv.created_at ASC
    `

    lectureViews.forEach(view => {
      events.push({
        id: events.length + 1,
        timestamp: new Date(view.created_at).toLocaleString(),
        type: 'lecture_view',
        module: 'Lectures',
        topic: `Week ${view.week}`,
        description: `Viewed: ${view.lecture_title}`,
        success: true
      })
    })

    // 2. AI Questions
    const aiQuestions = await sql`
      SELECT 
        created_at,
        topic,
        message,
        context
      FROM ai_tutor_conversations
      WHERE student_id = ${studentId}
        AND created_at >= NOW() - INTERVAL '60 days'
      ORDER BY created_at ASC
    `

    aiQuestions.forEach(q => {
      let moduleSource = 'AI Chat'
      try {
        if (q.context) {
          const context = typeof q.context === 'string' ? JSON.parse(q.context) : q.context
          if (context.source === 'lecture') moduleSource = 'Lectures'
          else if (context.source === 'practice') moduleSource = 'Practice Hub'
        }
      } catch (e) {}

      events.push({
        id: events.length + 1,
        timestamp: new Date(q.created_at).toLocaleString(),
        type: 'ai_question',
        module: moduleSource,
        topic: q.topic || 'General',
        description: q.message.substring(0, 100) + (q.message.length > 100 ? '...' : ''),
        success: false // Indicates confusion/need for help
      })
    })

    // 3. Practice attempts
    const practiceAttempts = await sql`
      SELECT 
        created_at,
        score,
        topic
      FROM practice_attempts
      WHERE student_id = ${studentId}
        AND created_at >= NOW() - INTERVAL '60 days'
      ORDER BY created_at ASC
    `

    practiceAttempts.forEach(attempt => {
      events.push({
        id: events.length + 1,
        timestamp: new Date(attempt.created_at).toLocaleString(),
        type: 'practice',
        module: 'Practice Hub',
        topic: attempt.topic || 'Practice',
        description: `Completed practice problem`,
        success: attempt.score >= 70,
        score: attempt.score
      })
    })

    // 4. Quiz attempts
    const quizAttempts = await sql`
      SELECT 
        qa.completed_at,
        qa.score,
        q.title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      WHERE qa.student_id = ${studentId}
        AND qa.completed_at IS NOT NULL
        AND qa.completed_at >= NOW() - INTERVAL '60 days'
      ORDER BY qa.completed_at ASC
    `

    quizAttempts.forEach(attempt => {
      events.push({
        id: events.length + 1,
        timestamp: new Date(attempt.completed_at).toLocaleString(),
        type: 'quiz',
        module: 'Assessments',
        topic: attempt.title,
        description: `Completed quiz`,
        success: attempt.score >= 70,
        score: attempt.score
      })
    })

    // 5. Topic mastery achievements
    const masteryAchievements = await sql`
      SELECT 
        topic,
        mastery_percentage,
        updated_at
      FROM ai_tutor_topic_mastery
      WHERE student_id = ${studentId}
        AND mastery_percentage >= 75
        AND updated_at >= NOW() - INTERVAL '60 days'
      ORDER BY updated_at ASC
    `

    masteryAchievements.forEach(achievement => {
      events.push({
        id: events.length + 1,
        timestamp: new Date(achievement.updated_at).toLocaleString(),
        type: 'mastery',
        module: 'Achievement',
        topic: achievement.topic,
        description: `Mastered topic!`,
        success: true,
        score: achievement.mastery_percentage
      })
    })

    // Sort all events by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Calculate overall mastery
    const overallMastery = await sql`
      SELECT AVG(mastery_percentage) as avg_mastery
      FROM ai_tutor_topic_mastery
      WHERE student_id = ${studentId}
    `

    // Get weak topics
    const weakTopics = await sql`
      SELECT topic
      FROM ai_tutor_topic_mastery
      WHERE student_id = ${studentId}
        AND mastery_percentage < 60
      ORDER BY mastery_percentage ASC
      LIMIT 5
    `

    const path = {
      student_id: studentInfo[0].id,
      student_name: studentInfo[0].full_name,
      student_code: studentInfo[0].student_id,
      events: events,
      current_mastery: Math.round(Number(overallMastery[0]?.avg_mastery || 0)),
      weak_topics: weakTopics.map(t => t.topic)
    }

    return NextResponse.json({ path })
  } catch (error) {
    console.error("[Learning Path] Error:", error)
    return NextResponse.json({ 
      path: null,
      error: "Failed to fetch learning path" 
    }, { status: 500 })
  }
}

