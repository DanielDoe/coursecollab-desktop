import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { getBaseUrl } from "@/lib/get-base-url"
import { resolveClassroomAwardInstructorId } from "@/lib/classroom-points-award-instructor"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { code, challengeId, challengeTitle, challengeDescription, studentId, score, feedback } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      )
    }

    const studentInfo = await sql`
      SELECT id, section FROM students WHERE id = ${auth.studentDbId}
    `
    
    if (studentInfo.length === 0) {
      return NextResponse.json(
        { error: "Student session is invalid" },
        { status: 401 }
      )
    }

    const student = studentInfo[0]
    const normalizedScore =
      typeof score === "number" && Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0
    
    // HALF POINTS: Always award 50% for submitting code
    const codeSubmissionPoints = 2.5 // 50% of total (always awarded)
    
    // HALF POINTS: Award up to 50% based on evaluation score (0-10 scale)
    // Score 10/10 = 2.5 points, Score 5/10 = 1.25 points, Score 0/10 = 0 points
    const evaluationPoints = (normalizedScore / 10) * 2.5 // Up to 50% of total
    
    const awardedPoints = codeSubmissionPoints + evaluationPoints
    const finalPoints = Math.max(2.5, parseFloat(awardedPoints.toFixed(2))) // Minimum 2.5 points (code submission only)

    const instructorId = await resolveClassroomAwardInstructorId({
      studentDbId: Number(student.id),
    })

    // Create daily_challenge_submissions table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS daily_challenge_submissions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        challenge_id VARCHAR(100) NOT NULL,
        challenge_title TEXT NOT NULL,
        challenge_description TEXT NOT NULL,
        score DECIMAL(3,1),
        points_awarded DECIMAL(5,2),
        feedback TEXT,
        detailed_feedback TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        practice_point_id INTEGER,
        submitted_at TIMESTAMP DEFAULT NOW()
      )
    `

    // Create pending_practice_points table for instructor approval (if not exists)
    await sql`
      CREATE TABLE IF NOT EXISTS pending_practice_points (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        points DECIMAL(5,2) NOT NULL CHECK (points > 0),
        reason TEXT NOT NULL,
        daily_challenge_submission_id INTEGER REFERENCES daily_challenge_submissions(id),
        awarded_by INTEGER NOT NULL REFERENCES instructors(id),
        session VARCHAR(64) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        awarded_at TIMESTAMP
      )
    `

    // Ensure status column exists
    await sql`
      ALTER TABLE pending_practice_points 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'
    `

    try {
      await sql`
        ALTER TABLE pending_practice_points
        ALTER COLUMN session TYPE VARCHAR(64)
      `
    } catch {
      // Column already widened or table managed by migration.
    }

    // Create pending practice point entry
    const evaluationPart = normalizedScore > 0 
      ? `Evaluation Score: ${normalizedScore.toFixed(1)}/10`
      : `Evaluation Score: 0/10 (No points for evaluation)`
    const reasonBase = `Daily Challenge Submission - ${evaluationPart}`
    const feedbackText = feedback || (normalizedScore === 0 ? "Daily challenge solved but evaluation questions answered incorrectly" : "Daily challenge evaluation")
    const fullReason = `${reasonBase} - ${feedbackText}`

    const pointResult = await sql`
      INSERT INTO pending_practice_points (
        student_id,
        points,
        reason,
        awarded_by,
        session,
        status
      ) VALUES (
        ${student.id},
        ${finalPoints},
        ${fullReason},
        ${instructorId},
        ${student.section},
        'pending'
      )
      RETURNING *
    `
    
    const practicePointId = pointResult[0]?.id

    // Store submission - use a simpler approach without complex UNIQUE constraint
    const challengeIdValue = challengeId || `challenge_${new Date().toISOString().split("T")[0]}`
    const today = new Date().toISOString().split("T")[0]
    
    // Check if submission already exists for today
    const existingSubmission = await sql`
      SELECT id FROM daily_challenge_submissions 
      WHERE student_id = ${auth.studentDbId} 
        AND challenge_id = ${challengeIdValue}
        AND DATE(submitted_at) = ${today}
      LIMIT 1
    `
    
    if (existingSubmission.length > 0) {
      // Update existing submission
      await sql`
        UPDATE daily_challenge_submissions SET
          code = ${code},
          score = ${normalizedScore},
          points_awarded = ${finalPoints},
          feedback = ${`Score: ${normalizedScore.toFixed(1)}/10`},
          detailed_feedback = ${feedback || "Daily challenge evaluation completed"},
          status = 'pending',
          practice_point_id = ${practicePointId || null},
          submitted_at = NOW()
        WHERE id = ${existingSubmission[0].id}
      `
    } else {
      // Insert new submission
      await sql`
        INSERT INTO daily_challenge_submissions (
          student_id, code, challenge_id, challenge_title, challenge_description,
          score, points_awarded, feedback, detailed_feedback, status, practice_point_id, submitted_at
        )
        VALUES (
          ${auth.studentDbId}, 
          ${code}, 
          ${challengeIdValue},
          ${challengeTitle || "Daily Challenge"},
          ${challengeDescription || ""},
          ${normalizedScore},
          ${finalPoints},
          ${`Score: ${normalizedScore.toFixed(1)}/10`},
          ${feedback || "Daily challenge evaluation completed"},
          'pending',
          ${practicePointId || null},
          NOW()
        )
      `
    }

    // Record streak activity (fire-and-forget - don't block response)
    // This is non-critical and shouldn't delay the response
    fetch(`${getBaseUrl()}/api/codebench/streak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: auth.studentDbId }),
    }).catch(() => {
      // Ignore errors - streak is calculated from submissions and is not critical
    })

    // Award badges based on performance (async, don't wait)
    fetch(`${getBaseUrl()}/api/codebench/badges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id })
    }).catch(err => console.error("[Daily Challenge Submit] Failed to award badges:", err))

    return NextResponse.json({
      success: true,
      message: "Daily challenge submitted. Points pending instructor approval.",
      evaluation: {
        score: normalizedScore,
        maxScore: 10,
        pointsAwarded: finalPoints,
        codeSubmissionPoints: codeSubmissionPoints, // 50% - always awarded for code submission
        evaluationPoints: evaluationPoints, // Up to 50% - based on evaluation score
        maxPoints: 5.0,
        breakdown: {
          codeSubmission: `${codeSubmissionPoints.toFixed(2)} points (50% - always awarded)`,
          evaluation: `${evaluationPoints.toFixed(2)} points (up to 50% - based on score ${normalizedScore.toFixed(1)}/10)`,
          total: `${finalPoints.toFixed(2)} points`
        },
        feedback: feedback || "Daily challenge evaluation completed",
        status: "pending",
      },
    }, { status: 200 })
  } catch (error: any) {
    console.error("[Daily Challenge Submit] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit daily challenge" },
      { status: 500 }
    )
  }
}

