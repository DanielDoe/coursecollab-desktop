import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { finalizePracticeAttempt } from "@/lib/practice-attempt-update"
import { loadPracticeAttemptById } from "@/lib/practice-attempt-load"
import { normalizePracticeStudentAnswer } from "@/lib/save-practice-answer"
import { requirePracticeAttemptOwnership } from "@/lib/require-student-practice-auth"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function POST(request: NextRequest) {
  console.log("🔥 [PRACTICE SUBMIT] ===== STARTING SUBMISSION =====")
  
  try {
    const body = await request.json()
    const { attemptId } = body

    if (!attemptId) {
      console.log("🔥 [PRACTICE SUBMIT] ERROR: Missing attemptId")
      return NextResponse.json({ error: "Missing attemptId" }, { status: 400 })
    }

    const auth = await requirePracticeAttemptOwnership(request, Number(attemptId))
    if (!auth.ok) return auth.response
    const studentDbId = auth.studentDbId

    console.log("🔥 [PRACTICE SUBMIT] Request received:", {
      attemptId,
      studentId: studentDbId
    })

    console.log("🔥 [PRACTICE SUBMIT] Fetching attempt from database...")
    
    // Get attempt details (explicit columns — schema varies across deployments)
    const attempt = await loadPracticeAttemptById(attemptId, studentDbId)

    console.log("🔥 [PRACTICE SUBMIT] Attempt query result:", attempt)

    if (!attempt) {
      console.log("🔥 [PRACTICE SUBMIT] ERROR: No attempt found")
      return NextResponse.json({ error: "Practice attempt not found" }, { status: 404 })
    }

    console.log("🔥 [PRACTICE SUBMIT] Found attempt:", attempt)

    console.log("🔥 [PRACTICE SUBMIT] Reading already-saved answers from database...")
    
    // Read the already-saved answers from practice_answers table
    const savedAnswers = await sql`
      SELECT 
        pa.*,
        qb.question_text,
        qb.difficulty,
        qb.topic,
        qb.correct_answer
      FROM practice_answers pa
      JOIN question_bank qb ON pa.bank_question_id = qb.id
      WHERE pa.attempt_id = ${attemptId}
    `

    console.log(`🔥 [PRACTICE SUBMIT] Found ${savedAnswers.length} saved answers`)

    if (savedAnswers.length === 0) {
      console.log("🔥 [PRACTICE SUBMIT] ERROR: No saved answers for attempt")
      return NextResponse.json(
        {
          error:
            "No answers were saved for this practice session. Please retake the quiz — your responses may not have been recorded.",
        },
        { status: 400 },
      )
    }

    // Count correct answers
    const correctCount = savedAnswers.filter(a => a.is_correct).length
    const totalQuestions = savedAnswers.length
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
    
    console.log(`🔥 [PRACTICE SUBMIT] Final score: ${correctCount}/${totalQuestions} = ${score}%`)

    // Build submittedAnswers array for response
    const submittedAnswers = savedAnswers.map((answer) => ({
      question_id: answer.bank_question_id,
      question_text: answer.question_text,
      selected_answer: normalizePracticeStudentAnswer(answer.student_answer),
      correct_answer: answer.correct_answer,
      is_correct: answer.is_correct,
      difficulty: answer.difficulty,
      topic: answer.topic,
    }))

        // Update attempt with final score (schema-safe across deployments)
        console.log("🔥 [PRACTICE SUBMIT] Updating attempt...")
        const rawStarted = attempt.started_at ?? attempt.created_at ?? new Date()
        const startedAt =
          rawStarted instanceof Date ? rawStarted.toISOString() : String(rawStarted)
        await finalizePracticeAttempt({
          attemptId,
          correctCount,
          score,
          startedAt,
        })
    console.log("🔥 [PRACTICE SUBMIT] Updated attempt")

    // Update leaderboard using the stored procedure
    console.log("🔥 [PRACTICE SUBMIT] Updating leaderboard...")
    try {
      await sql`SELECT update_practice_leaderboard(${studentDbId}, ${score}, ${totalQuestions})`
      console.log("🔥 [PRACTICE SUBMIT] Updated leaderboard")
    } catch (leaderboardError) {
      console.log("🔥 [PRACTICE SUBMIT] Leaderboard update failed (non-critical):", leaderboardError)
    }

    // Update topic progress for each topic practiced
    console.log("🔥 [PRACTICE SUBMIT] Updating topic progress...")
    try {
      // Group answers by topic
      const topicStats = submittedAnswers.reduce((acc, answer) => {
        if (!acc[answer.topic]) {
          acc[answer.topic] = { total: 0, correct: 0 }
        }
        acc[answer.topic].total++
        if (answer.is_correct) acc[answer.topic].correct++
        return acc
      }, {} as Record<string, { total: number; correct: number }>)

      // Update progress for each topic
      for (const [topic, stats] of Object.entries(topicStats)) {
        const topicAccuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
        
        await sql`
          INSERT INTO student_topic_progress (
            student_id,
            topic,
            questions_completed,
            questions_correct,
            accuracy,
            last_practiced
          ) VALUES (
            ${studentDbId},
            ${topic},
            ${stats.total},
            ${stats.correct},
            ${topicAccuracy},
            NOW()
          )
          ON CONFLICT (student_id, topic) 
          DO UPDATE SET 
            questions_completed = student_topic_progress.questions_completed + ${stats.total},
            questions_correct = student_topic_progress.questions_correct + ${stats.correct},
            accuracy = ROUND(
              (student_topic_progress.questions_correct + ${stats.correct})::NUMERIC / 
              (student_topic_progress.questions_completed + ${stats.total}) * 100
            ),
            last_practiced = NOW()
        `
        console.log(`🔥 [PRACTICE SUBMIT] Updated progress for topic: ${topic}`)
      }
    } catch (progressError) {
      console.log("🔥 [PRACTICE SUBMIT] Topic progress update failed (non-critical):", progressError)
    }

    // Sync activity points to Trade Center (background, non-blocking)
    try {
      const courseRows = await sql`SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1`
      const { getPracticeHubPolicyForCourse } = await import("@/lib/practice-hub-policy-settings.server")
      const hubPolicy = await getPracticeHubPolicyForCourse(
        courseRows[0]?.course_id != null ? Number(courseRows[0].course_id) : null,
      )
      if (hubPolicy.sync_engagement_points) {
        const { syncActivityPointsAfterAction } = await import("@/lib/trade-center-sync")
        const studentSession = request.headers.get("x-student-session") || "ALL"
        await syncActivityPointsAfterAction(studentDbId, studentSession, "practice")
        console.log("🔥 [PRACTICE SUBMIT] Synced practice points to Trade Center")
      }
    } catch (syncError) {
      console.log("🔥 [PRACTICE SUBMIT] Trade Center sync failed (non-critical):", syncError)
    }

    // Generate and save learning report (background, non-blocking)
    try {
      const reportData = await sql`SELECT generate_practice_report(${attemptId}) as report`
      if (reportData[0]?.report) {
        await sql`
          SELECT save_learning_report(
            ${studentDbId}::INTEGER,
            'practice'::VARCHAR,
            ${attemptId}::INTEGER,
            ${reportData[0].report}::JSONB
          )
        `
        console.log("🔥 [PRACTICE SUBMIT] Generated and saved learning report")
      }
    } catch (reportError) {
      console.log("🔥 [PRACTICE SUBMIT] Report generation failed (non-critical):", reportError)
    }

    console.log("🔥 [PRACTICE SUBMIT] ===== SUBMISSION SUCCESSFUL =====")

    void (async () => {
      try {
        const { recordPracticeAnalytics } = await import("@/lib/institutions/learning-analytics")
        const { engageInterventionsAfterPractice } = await import("@/lib/institutions/interventions")
        const courseRows = await sql`SELECT course_id FROM students WHERE id = ${studentDbId} LIMIT 1`
        const courseId = courseRows[0]?.course_id != null ? Number(courseRows[0].course_id) : null
        await recordPracticeAnalytics({
          studentId: studentDbId,
          attemptId: Number(attemptId),
          courseId,
          score,
          correctCount,
          totalQuestions,
          completed: true,
        })
        await engageInterventionsAfterPractice(studentDbId)
      } catch {
        /* analytics must not block submit */
      }
    })()

    return NextResponse.json({
      success: true,
      attemptId,
      score,
      correctCount,
      totalQuestions,
      submittedAnswers,
      topics: [...new Set(submittedAnswers.map(a => a.topic))].join(", ")
    })

  } catch (error) {
    console.log("🔥 [PRACTICE SUBMIT] ===== SUBMISSION FAILED =====")
    console.log("🔥 [PRACTICE SUBMIT] ERROR:", error)
    return NextResponse.json({ error: "Failed to submit practice" }, { status: 500 })
  }
}