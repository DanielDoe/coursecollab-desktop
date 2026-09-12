import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { getBaseUrl } from "@/lib/get-base-url"
import { resolveClassroomAwardInstructorId } from "@/lib/classroom-points-award-instructor"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { code, studentId, problem, constraints, sampleInput, sampleOutput, feedback } = await request.json()

    const auth = await requireCodebenchStudent(request, studentId != null ? String(studentId) : null)
    if (!auth.ok) return auth.response

    if (!code || !problem) {
      return NextResponse.json(
        { error: "Code and problem are required" },
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
    const normalizedScore = 0
    const codeSubmissionPoints = 2.5 // Always award for code submission
    const evaluationPoints = (normalizedScore / 10) * 2.5 // Evaluation points (0-2.5 based on score)
    const awardedPoints = codeSubmissionPoints + evaluationPoints
    const finalPoints = Math.max(2.5, parseFloat(awardedPoints.toFixed(2))) // Minimum 2.5 points (code submission only)

    const instructorId = await resolveClassroomAwardInstructorId({
      studentDbId: Number(student.id),
    })

    // Create practice_submissions table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS practice_submissions (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        problem TEXT NOT NULL,
        constraints TEXT,
        sample_input TEXT,
        sample_output TEXT,
        score DECIMAL(4,1),
        points_awarded DECIMAL(5,2),
        feedback TEXT,
        detailed_feedback TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        practice_point_id INTEGER,
        submitted_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(student_id, problem, submitted_at)
      )
    `

    // Create pending_practice_points table for instructor approval
    await sql`
      CREATE TABLE IF NOT EXISTS pending_practice_points (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        points DECIMAL(5,2) NOT NULL CHECK (points > 0),
        reason TEXT NOT NULL,
        practice_submission_id INTEGER REFERENCES practice_submissions(id),
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
    const reasonBase = `Practice Problem Submission - ${evaluationPart}`
    const feedbackText = feedback || (normalizedScore === 0 ? "Practice problem solved but evaluation questions answered incorrectly" : "Practice problem evaluation")
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

    // Store submission
    await sql`
      INSERT INTO practice_submissions (
        student_id, code, problem, constraints, sample_input, sample_output, 
        score, points_awarded, feedback, detailed_feedback, status, practice_point_id, submitted_at
      )
      VALUES (
        ${auth.studentDbId}, 
        ${code}, 
        ${problem},
        ${constraints || null},
        ${sampleInput || null},
        ${sampleOutput || null},
        ${normalizedScore},
        ${finalPoints},
        ${`Score: ${normalizedScore.toFixed(1)}/10`},
        ${feedback || "Practice problem evaluation completed"},
        'pending',
        ${practicePointId || null},
        NOW()
      )
      ON CONFLICT (student_id, problem, submitted_at) 
      DO UPDATE SET 
        code = ${code},
        score = ${normalizedScore},
        points_awarded = ${finalPoints},
        feedback = ${`Score: ${normalizedScore.toFixed(1)}/10`},
        detailed_feedback = ${feedback || "Practice problem evaluation completed"},
        status = 'pending',
        practice_point_id = ${practicePointId || null},
        submitted_at = NOW()
    `

      // Record streak activity
      try {
        await fetch(`${getBaseUrl()}/api/codebench/streak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: auth.studentDbId }),
        }).catch(() => {
          // Ignore errors - streak is calculated from submissions
        })
      } catch (e) {
        // Ignore errors
      }

      // Award badges based on performance (async, don't wait)
      fetch(`${getBaseUrl()}/api/codebench/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: student.id })
      }).catch(err => console.error("[Practice Submit] Failed to award badges:", err))

      return NextResponse.json({
        success: true,
        message: "Practice problem submitted. Points pending instructor approval.",
        evaluation: {
          score: normalizedScore,
          maxScore: 10,
          pointsAwarded: finalPoints,
        codeSubmissionPoints: 2.5,
        evaluationPoints: evaluationPoints,
        maxPoints: 5.0,
        feedback: feedback || "Practice problem evaluation completed",
        status: "pending",
      },
    })
  } catch (error: any) {
    console.error("[Practice Submit] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit practice problem" },
      { status: 500 }
    )
  }
}

