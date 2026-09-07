import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    
    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const quizId = searchParams.get("quizId")
    const assessmentType = searchParams.get("assessmentType") || "quiz"

    if (!quizId) {
      return NextResponse.json({ error: "Quiz ID required" }, { status: 400 })
    }

    console.log(`[Assessment Analytics API] Fetching analytics for quizId: ${quizId}, type: ${assessmentType}`)

    // Verify the quiz exists and matches the assessment type
    const quizCheck = await sql`
      SELECT id, title, assessment_type 
      FROM quizzes 
      WHERE id = ${quizId} AND assessment_type = ${assessmentType}
      LIMIT 1
    `

    if (quizCheck.length === 0) {
      console.log(`[Assessment Analytics API] Quiz not found or type mismatch`)
      return NextResponse.json({ error: "Assessment not found or type mismatch" }, { status: 404 })
    }

    console.log(`[Assessment Analytics API] Found assessment: ${quizCheck[0].title} (${quizCheck[0].assessment_type})`)

    // 1. Question-level Analysis
    const questionAnalysis = await sql`
      WITH question_stats AS (
        SELECT 
          q.id as question_id,
          q.question_text,
          q.question_order,
          q.question_type,
          COUNT(qa_ans.id) as total_attempts,
          COUNT(CASE WHEN qa_ans.is_correct = true THEN 1 END) as correct_count,
          COUNT(CASE WHEN qa_ans.is_correct = false OR qa_ans.is_correct IS NULL THEN 1 END) as incorrect_count,
          AVG(CASE WHEN qa_ans.answered_at IS NOT NULL THEN EXTRACT(EPOCH FROM (qa_ans.answered_at - qa.started_at)) ELSE 0 END) as avg_time_spent,
          ARRAY_AGG(qa_ans.selected_answer) FILTER (WHERE qa_ans.is_correct = false AND qa_ans.selected_answer IS NOT NULL) as wrong_answers
        FROM quiz_questions q
        LEFT JOIN quiz_answers qa_ans ON q.id = qa_ans.question_id
        LEFT JOIN quiz_attempts qa ON qa_ans.attempt_id = qa.id
        WHERE q.quiz_id = ${quizId}
          AND (qa.completed_at IS NOT NULL OR qa.id IS NULL)
        GROUP BY q.id, q.question_text, q.question_order, q.question_type
      )
      SELECT 
        question_id,
        question_text,
        question_order,
        question_type,
        total_attempts::integer,
        correct_count::integer,
        incorrect_count::integer,
        ROUND((correct_count::numeric / NULLIF(total_attempts, 0) * 100)::numeric, 1)::numeric as accuracy_rate,
        ROUND(avg_time_spent::numeric, 1)::numeric as avg_time_spent,
        wrong_answers,
        CASE 
          WHEN (correct_count::numeric / NULLIF(total_attempts, 0) * 100) >= 80 THEN 'easy'
          WHEN (correct_count::numeric / NULLIF(total_attempts, 0) * 100) >= 60 THEN 'medium'
          WHEN (correct_count::numeric / NULLIF(total_attempts, 0) * 100) >= 40 THEN 'hard'
          ELSE 'very_hard'
        END as difficulty_rating
      FROM question_stats
      ORDER BY question_order ASC
    `

    // Process wrong answers to get common ones
    const processedQuestions = questionAnalysis.map(q => {
      const wrongAnswersMap = new Map()
      
      if (q.wrong_answers) {
        q.wrong_answers.forEach((ans: string) => {
          if (ans) {
            const count = wrongAnswersMap.get(ans) || 0
            wrongAnswersMap.set(ans, count + 1)
          }
        })
      }

      const common_wrong_answers = Array.from(wrongAnswersMap.entries())
        .map(([answer, count]) => ({ answer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)

      return {
        ...q,
        question_id: Number(q.question_id), // Ensure it's a number
        question_order: Number(q.question_order),
        accuracy_rate: Number(q.accuracy_rate || 0),
        avg_time_spent: Number(q.avg_time_spent || 0),
        common_wrong_answers
      }
    })

    // Check for duplicates and remove them
    const questionIds = processedQuestions.map(q => q.question_id)
    const uniqueIds = new Set(questionIds)
    
    let finalQuestions = processedQuestions
    if (questionIds.length !== uniqueIds.size) {
      console.error('[Assessment Analytics] ⚠️  DUPLICATE QUESTION IDs DETECTED!')
      console.error('[Assessment Analytics] Total questions:', questionIds.length)
      console.error('[Assessment Analytics] Unique IDs:', uniqueIds.size)
      
      const duplicates = questionIds.filter((id, index) => questionIds.indexOf(id) !== index)
      console.error('[Assessment Analytics] Duplicate IDs:', [...new Set(duplicates)])
      
      // Deduplicate: Keep only the first occurrence of each question_id
      const seen = new Set()
      finalQuestions = processedQuestions.filter(q => {
        if (seen.has(q.question_id)) {
          console.warn(`[Assessment Analytics] Removing duplicate question_id: ${q.question_id}`)
          return false
        }
        seen.add(q.question_id)
        return true
      })
      
      console.log(`[Assessment Analytics] After deduplication: ${finalQuestions.length} questions`)
    }
    
    console.log(`[Assessment Analytics] Returning ${finalQuestions.length} questions for quiz ${quizId}`)

    // 2. Performance Distribution
    const performanceDistribution = await sql`
      WITH score_ranges AS (
        SELECT 
          CASE 
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 90 THEN '90-100%'
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 80 THEN '80-89%'
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 70 THEN '70-79%'
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 60 THEN '60-69%'
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 50 THEN '50-59%'
            ELSE '0-49%'
          END as range,
          CASE 
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 90 THEN 6
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 80 THEN 5
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 70 THEN 4
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 60 THEN 3
            WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 50 THEN 2
            ELSE 1
          END as sort_order
        FROM quiz_attempts
        WHERE quiz_id = ${quizId}
          AND completed_at IS NOT NULL
      )
      SELECT 
        range,
        COUNT(*)::integer as count,
        MIN(sort_order) as sort_order
      FROM score_ranges
      GROUP BY range
      ORDER BY sort_order ASC
    `

    const totalStudents = performanceDistribution.reduce((sum, d) => sum + d.count, 0)
    const distributionWithPercentage = performanceDistribution.map(d => ({
      ...d,
      percentage: totalStudents > 0 ? Math.round((d.count / totalStudents) * 100) : 0
    }))

    // 3. Time Analysis per Question
    const timeAnalysis = await sql`
      SELECT 
        q.question_order,
        ROUND(AVG(CASE WHEN qa_ans.answered_at IS NOT NULL THEN EXTRACT(EPOCH FROM (qa_ans.answered_at - qa.started_at)) ELSE 0 END)::numeric, 1)::numeric as avg_time,
        COUNT(CASE WHEN qa_ans.selected_answer IS NOT NULL THEN 1 END)::integer as completed,
        COUNT(qa_ans.id)::integer as total
      FROM quiz_questions q
      LEFT JOIN quiz_answers qa_ans ON q.id = qa_ans.question_id
      LEFT JOIN quiz_attempts qa ON qa_ans.attempt_id = qa.id
      WHERE q.quiz_id = ${quizId}
      GROUP BY q.id, q.question_order
      ORDER BY q.question_order ASC
    `

    const processedTimeAnalysis = timeAnalysis.map(t => ({
      question_order: Number(t.question_order),
      avg_time: Number(t.avg_time || 0),
      completion_rate: t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0
    }))

    // 4. Struggling Students (score < 60% or >50% questions wrong)
    const strugglingStudents = await sql`
      WITH student_attempts AS (
        SELECT 
          qa.student_id,
          qa.score,
          qa.total_questions,
          ROUND((qa.score::numeric / NULLIF(qa.total_questions, 0) * 100)::numeric, 1) as percentage,
          COUNT(CASE WHEN qa_ans.is_correct = false OR qa_ans.is_correct IS NULL THEN 1 END) as questions_wrong,
          COUNT(qa_ans.id) as questions_attempted
        FROM quiz_attempts qa
        LEFT JOIN quiz_answers qa_ans ON qa.id = qa_ans.attempt_id
        WHERE qa.quiz_id = ${quizId}
          AND qa.completed_at IS NOT NULL
        GROUP BY qa.id, qa.student_id, qa.score, qa.total_questions
        HAVING 
          ROUND((qa.score::numeric / NULLIF(qa.total_questions, 0) * 100)::numeric, 1) < 60
      )
      SELECT 
        s.full_name as student_name,
        s.student_id,
        sa.score,
        sa.percentage,
        sa.questions_attempted,
        sa.questions_wrong
      FROM student_attempts sa
      JOIN students s ON sa.student_id = s.id
      ORDER BY sa.percentage ASC
      LIMIT 20
    `

    const processedStrugglingStudents = strugglingStudents.map(s => ({
      ...s,
      questions_wrong: Number(s.questions_wrong),
      questions_attempted: Number(s.questions_attempted),
      score: Number(s.score || 0),
      weak_areas: s.weak_areas || []
    }))

    // 5. Overall Stats
    const overallStats = await sql`
      SELECT 
        COUNT(*)::integer as total_attempts,
        ROUND(AVG((score::numeric / NULLIF(total_questions, 0) * 100))::numeric, 1)::numeric as avg_score,
        ROUND((COUNT(CASE WHEN (score::numeric / NULLIF(total_questions, 0) * 100) >= 70 THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1)::numeric as pass_rate,
        ROUND((COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1)::numeric as completion_rate,
        ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60)::numeric, 1)::numeric as avg_time_minutes
      FROM quiz_attempts
      WHERE quiz_id = ${quizId}
    `

    const stats = {
      totalAttempts: Number(overallStats[0]?.total_attempts || 0),
      avgScore: Number(overallStats[0]?.avg_score || 0),
      passRate: Number(overallStats[0]?.pass_rate || 0),
      completionRate: Number(overallStats[0]?.completion_rate || 0),
      avgTimeMinutes: Number(overallStats[0]?.avg_time_minutes || 0)
    }

    return NextResponse.json({
      questionAnalysis: finalQuestions,
      performanceDistribution: distributionWithPercentage,
      timeAnalysis: processedTimeAnalysis,
      strugglingStudents: processedStrugglingStudents,
      overallStats: stats
    })
  } catch (error) {
    console.error("[Assessment Analytics] Error:", error)
    return NextResponse.json({
      questionAnalysis: [],
      performanceDistribution: [],
      timeAnalysis: [],
      strugglingStudents: [],
      overallStats: {
        totalAttempts: 0,
        avgScore: 0,
        passRate: 0,
        completionRate: 0,
        avgTimeMinutes: 0
      }
    }, { status: 200 })
  }
}

