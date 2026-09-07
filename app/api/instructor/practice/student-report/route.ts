import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { studentBelongsToCourse } from "@/lib/instructor-practice-scope"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const sid = Number(studentId)
    const inCourse = await studentBelongsToCourse(sid, scope.course.id)
    if (!inCourse) {
      return NextResponse.json(
        { error: "Student not found in this course scope" },
        { status: 403 },
      )
    }

    const student = await sql`
      SELECT id, full_name, email, section
      FROM students
      WHERE id = ${sid}
    `

    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    // Get all practice attempts
    const attempts = await sql`
      SELECT 
        id,
        topics,
        difficulty,
        total_questions,
        correct_answers,
        score_percentage,
        started_at,
        completed_at,
        time_spent_seconds
      FROM practice_attempts
      WHERE student_id = ${sid}
      AND completed_at IS NOT NULL
      ORDER BY started_at DESC
    `

    // Get practice answers with question details (handle if no answers)
    let answers = []
    try {
      answers = await sql`
        SELECT 
          pa.id,
          pa.attempt_id,
          pa.question_id,
          pa.student_answer,
          pa.is_correct,
          pa.response_time_seconds,
          pa.answered_at,
          qb.question_text,
          qb.question_type,
          qb.topic,
          qb.difficulty,
          qb.correct_answer,
          qb.option_a,
          qb.option_b,
          qb.option_c,
          qb.option_d,
          qb.option_e,
          qb.hint
        FROM practice_answers pa
        JOIN question_bank qb ON pa.question_id = qb.id
        WHERE pa.attempt_id IN (
          SELECT id FROM practice_attempts 
          WHERE student_id = ${sid}
        )
        ORDER BY pa.answered_at DESC
        LIMIT 100
      `
    } catch (_answersError) {
      answers = []
    }

    // Get leaderboard position (handle if table doesn't exist)
    let studentLeaderboard = null
    try {
      const leaderboard = await sql`
        SELECT 
          student_id,
          xp,
          level,
          total_questions_attempted,
          total_correct,
          accuracy_percentage,
          ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
        FROM practice_leaderboard
      `
      studentLeaderboard = leaderboard.find((l) => Number(l.student_id) === sid)
    } catch {
      studentLeaderboard = null
    }

    // Get topic-wise performance (handle if no data)
    let topicPerformance = []
    try {
      topicPerformance = await sql`
        SELECT 
          qb.topic,
          COUNT(pa.id) as total_questions,
          SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END) as correct_answers,
          ROUND(AVG(CASE WHEN pa.is_correct THEN 100 ELSE 0 END), 2) as accuracy
        FROM practice_answers pa
        JOIN question_bank qb ON pa.question_id = qb.id
        WHERE pa.attempt_id IN (
          SELECT id FROM practice_attempts 
          WHERE student_id = ${sid}
        )
        GROUP BY qb.topic
        ORDER BY total_questions DESC
      `
    } catch {
      topicPerformance = []
    }

    // Calculate overall stats
    const totalAttempts = attempts.length
    const totalQuestions = attempts.reduce((sum, a) => sum + Number(a.total_questions), 0)
    const totalCorrect = attempts.reduce((sum, a) => sum + Number(a.correct_answers), 0)
    const avgScore = totalAttempts > 0 
      ? attempts.reduce((sum, a) => sum + Number(a.score_percentage), 0) / totalAttempts
      : 0

    // Transform data
    const transformedAttempts = attempts.map(attempt => ({
      id: Number(attempt.id),
      topics: attempt.topics,
      difficulty: attempt.difficulty,
      total_questions: Number(attempt.total_questions),
      correct_answers: Number(attempt.correct_answers),
      score_percentage: Number(attempt.score_percentage),
      started_at: attempt.started_at,
      completed_at: attempt.completed_at,
      time_spent_seconds: Number(attempt.time_spent_seconds)
    }))

    const transformedAnswers = answers.map(answer => ({
      id: Number(answer.id),
      attempt_id: Number(answer.attempt_id),
      question_id: Number(answer.question_id),
      student_answer: answer.student_answer,
      is_correct: answer.is_correct,
      response_time_seconds: Number(answer.response_time_seconds || 0),
      answered_at: answer.answered_at,
      question: {
        text: answer.question_text,
        type: answer.question_type,
        topic: answer.topic,
        difficulty: answer.difficulty,
        correct_answer: answer.correct_answer,
        options: {
          a: answer.option_a,
          b: answer.option_b,
          c: answer.option_c,
          d: answer.option_d,
          e: answer.option_e
        },
        hint: answer.hint
      }
    }))

    const transformedTopicPerformance = topicPerformance.map(tp => ({
      topic: tp.topic,
      total_questions: Number(tp.total_questions),
      correct_answers: Number(tp.correct_answers),
      accuracy: Number(tp.accuracy)
    }))

    return NextResponse.json({
      student: {
        id: Number(student[0].id),
        name: student[0].full_name,
        email: student[0].email,
        section: student[0].section
      },
      overallStats: {
        totalAttempts,
        totalQuestions,
        totalCorrect,
        avgScore: Number(avgScore.toFixed(2)),
        accuracy: totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(2)) : 0
      },
      leaderboard: studentLeaderboard ? {
        rank: Number(studentLeaderboard.rank),
        xp: Number(studentLeaderboard.xp),
        level: Number(studentLeaderboard.level),
        totalQuestionsAttempted: Number(studentLeaderboard.total_questions_attempted),
        totalCorrect: Number(studentLeaderboard.total_correct),
        accuracy: Number(studentLeaderboard.accuracy_percentage)
      } : null,
      attempts: transformedAttempts,
      answers: transformedAnswers,
      topicPerformance: transformedTopicPerformance
    })
  } catch (error) {
    console.error("[Student Report API] Error:", error)
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: "Failed to fetch student report",
        details: msg,
      },
      { status: 500 },
    )
  }
}
