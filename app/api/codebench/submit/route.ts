import { type NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import OpenAI from "openai"
import { getBaseUrl } from "@/lib/get-base-url"

const isOpenAIConfigured = !!process.env.OPENAI_API_KEY
const openai = isOpenAIConfigured ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { code, assignmentId, studentId, answers, score, feedback, evaluationResponses, submissionId } = await request.json()

    console.log("[CodeBench Submit] 📥 Request received", {
      hasCode: !!code,
      codeLength: code?.length,
      studentId,
      submissionId,
      assignmentId,
      score,
      hasFeedback: !!feedback
    })

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
    const numericStudentId = auth.studentDbId

    // If submissionId is provided (assignment from classroom_point_submissions), ensure one submission per assignment
    // Students can submit from either Classroom Points module OR CodeBench, not both
    // CRITICAL: Use numericStudentId which is already resolved from the student lookup above
    if (submissionId) {
      console.log("[CodeBench Submit] Checking for existing submission", { 
        numericStudentId, 
        submissionId,
        submissionIdType: typeof submissionId 
      })
      
      const submissionIdNum = parseInt(submissionId)
      if (isNaN(submissionIdNum)) {
        console.error("[CodeBench Submit] Invalid submissionId:", submissionId)
        return NextResponse.json(
          { error: "Invalid assignment ID" },
          { status: 400 }
        )
      }
      
      const existingForAssignment = await sql`
        SELECT id, status, points FROM classroom_points
        WHERE student_id = ${numericStudentId}
          AND submission_id = ${submissionIdNum}
          AND category = 'code_submission'
        LIMIT 1
      `
      
      console.log("[CodeBench Submit] Duplicate check result", { 
        found: existingForAssignment.length > 0,
        status: existingForAssignment[0]?.status 
      })
      
      if (existingForAssignment.length > 0) {
        const existing = existingForAssignment[0]
        const status = existing.status || 'pending'
        // Idempotent: if retry after partial success, return success instead of error
        if (status === 'pending') {
          console.log("[CodeBench Submit] Idempotent: existing pending submission found", existing.id)
          return NextResponse.json({
            success: true,
            message: "Submission already recorded. Points pending instructor approval.",
            alreadySubmitted: true,
            pointsAwarded: parseFloat(existing.points?.toString() || '5'),
          })
        }
        return NextResponse.json(
          {
            error: `You have already submitted for this assignment (from Classroom Points or CodeBench). Status: ${status}. You cannot submit the same assignment twice.`,
            alreadySubmitted: true,
          },
          { status: 400 }
        )
      }
    }

    // If score provided directly (from chat evaluation), create pending point
    if (score !== undefined && typeof score === 'number') {
      const normalizedScore = 0
      
      // Award points:
      // - Practice-only (no assignment): 2.5 points (code submission only)
      // - Assignment submission: x2 CodeBench booster (2.5 base → 5–10 max)
      const codeSubmissionPoints = 2.5
      const evaluationPoints = submissionId ? (normalizedScore / 10) * 2.5 : 0
      const awardedPoints = codeSubmissionPoints + evaluationPoints
      let finalPoints = submissionId
        ? Math.max(2.5, parseFloat(awardedPoints.toFixed(2)))
        : 2.5 // Practice-only: fixed 2.5 points
      if (submissionId) {
        finalPoints = parseFloat((finalPoints * 2).toFixed(2)) // x2 booster for submitting on CodeBench
      }

      // Idempotency: For practice-only, check for recent duplicate (retry scenario)
      if (!submissionId) {
        const recentDuplicate = await sql`
          SELECT id FROM classroom_points
          WHERE student_id = ${numericStudentId}
            AND category = 'code_submission'
            AND submission_id IS NULL
            AND points = 2.5
            AND created_at > NOW() - INTERVAL '3 minutes'
          ORDER BY created_at DESC
          LIMIT 1
        `
        if (recentDuplicate.length > 0) {
          console.log("[CodeBench Submit] Idempotent: returning existing practice submission", recentDuplicate[0].id)
          return NextResponse.json({
            success: true,
            message: "Code submitted for practice. Points pending instructor approval.",
            pointsAwarded: 2.5,
          })
        }
      }

      // Get default instructor ID
      const instructorResult = await sql`
        SELECT id FROM instructors LIMIT 1
      `
      const instructorId = instructorResult[0]?.id || 1

      // Ensure classroom_points table has status column
      await sql`
        ALTER TABLE classroom_points 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'
      `
      
      // Try to change reason column to TEXT if it's VARCHAR(500) to support longer feedback
      try {
        await sql`
          ALTER TABLE classroom_points 
          ALTER COLUMN reason TYPE TEXT
        `
      } catch (error: any) {
        // Column might already be TEXT or migration might fail - that's okay, truncation will handle it
      }

      // Create pending classroom point entry
      // Truncate reason to 500 characters to avoid database errors (if column is still VARCHAR)
      const evaluationPart = normalizedScore > 0 
        ? `Evaluation Score: ${normalizedScore.toFixed(1)}/10`
        : `Evaluation Score: 0/10 (No points for evaluation)`
      const reasonBase = `Code Submission - ${evaluationPart}`
      const feedbackText = feedback || (normalizedScore === 0 ? "Code submitted but evaluation questions answered incorrectly" : "Comprehension evaluation")
      const fullReason = `${reasonBase} - ${feedbackText}`
      const truncatedReason = fullReason.length > 500 
        ? `${reasonBase} - ${feedbackText.substring(0, 500 - reasonBase.length - 3)}...`
        : fullReason

      // finalPoints already set above: 2.5 for practice, 2.5-5 for assignment

      // Ensure point_booster and submitted_via_codebench columns exist
      try {
        await sql`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS point_booster INTEGER DEFAULT 1`
        await sql`ALTER TABLE classroom_points ADD COLUMN IF NOT EXISTS submitted_via_codebench BOOLEAN DEFAULT false`
      } catch (_) {}

      // Check if submissionId is provided (for classroom point assignments)
      // If submissionId exists, link this to the classroom point submission
      // CodeBench submissions get x2 booster (submitted_via_codebench)
      let pointResult
      if (submissionId) {
        // Try inserting with submission_id and point_booster if columns exist
        try {
          pointResult = await sql`
            INSERT INTO classroom_points (
              student_id,
              points,
              reason,
              category,
              awarded_by,
              session,
              status,
              submission_id,
              point_booster,
              submitted_via_codebench
            ) VALUES (
              ${student.id},
              ${finalPoints},
              ${truncatedReason},
              'code_submission',
              ${instructorId},
              ${student.section},
              'pending',
              ${parseInt(submissionId)},
              2,
              true
            )
            RETURNING *
          `
        } catch (error: any) {
          // Fallback if point_booster/submitted_via_codebench or submission_id columns don't exist
          if (error.code === '42703' || error.message?.includes('column')) {
            pointResult = await sql`
              INSERT INTO classroom_points (
                student_id,
                points,
                reason,
                category,
                awarded_by,
                session,
                status,
                submission_id
              ) VALUES (
                ${student.id},
                ${finalPoints},
                ${truncatedReason},
                'code_submission',
                ${instructorId},
                ${student.section},
                'pending',
                ${parseInt(submissionId)}
              )
              RETURNING *
            `
          } else {
            throw error
          }
        }
      } else {
        // No submissionId - create general classroom point
        pointResult = await sql`
          INSERT INTO classroom_points (
            student_id,
            points,
            reason,
            category,
            awarded_by,
            session,
            status
          ) VALUES (
            ${student.id},
            ${finalPoints},
            ${truncatedReason},
            'code_submission',
            ${instructorId},
            ${student.section},
            'pending'
          )
          RETURNING *
        `
      }
      
      const classroomPointId = pointResult[0]?.id

      // Store submission
      await sql`
        CREATE TABLE IF NOT EXISTS codebench_submissions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          assignment_id INTEGER,
          code TEXT NOT NULL,
          score DECIMAL(4,1),
          points_awarded DECIMAL(5,2),
          feedback TEXT,
          detailed_feedback TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          classroom_point_id INTEGER,
          authenticity_score INTEGER,
          ai_likelihood DECIMAL(3,2),
          authorship_reasoning TEXT,
          flagged_features TEXT[],
          ai_suspicion BOOLEAN DEFAULT false,
          submitted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(student_id, assignment_id)
        )
      `
      
      // Add detailed_feedback and classroom_point_id columns if they don't exist
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS detailed_feedback TEXT
      `
      
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS classroom_point_id INTEGER
      `
      
      // Add authorship detection columns if they don't exist
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS authenticity_score INTEGER
      `
      
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS ai_likelihood DECIMAL(3,2)
      `
      
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS authorship_reasoning TEXT
      `
      
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS flagged_features TEXT[]
      `
      
      await sql`
        ALTER TABLE codebench_submissions 
        ADD COLUMN IF NOT EXISTS ai_suspicion BOOLEAN DEFAULT false
      `

      // Check code authenticity before storing
      let authenticityData = {
        authenticity_score: null as number | null,
        ai_likelihood: null as number | null,
        reasoning: null as string | null,
        flagged_features: [] as string[],
        ai_suspicion: false,
      }
      let statusToUse = 'pending'

      try {
        const { checkCodeAuthorship } = await import("@/lib/codebench-authorship")
        const authorshipResult = await checkCodeAuthorship(code, "cpp")
        authenticityData = {
          authenticity_score: authorshipResult.authenticity_score,
          ai_likelihood: authorshipResult.ai_likelihood,
          reasoning: authorshipResult.reasoning,
          flagged_features: authorshipResult.flagged_features,
          ai_suspicion: authorshipResult.authenticity_score < 50,
        }
        if (authenticityData.ai_suspicion) {
          statusToUse = 'needs_review'
        }
      } catch (authorshipError) {
        console.error("Failed to check code authorship:", authorshipError)
        // Continue with submission even if authorship check fails
      }

      // Extract detailed feedback from feedback string
      let detailedFeedback = feedback || "Comprehension evaluation completed"
      
      // Include evaluation responses if provided
      if (evaluationResponses && Array.isArray(evaluationResponses) && evaluationResponses.length > 0) {
        const qaSummary = evaluationResponses.map((qa: any, idx: number) => 
          `Q${idx + 1}: ${qa.question?.substring(0, 100)}...\nA${idx + 1}: ${qa.answer?.substring(0, 200)}...`
        ).join('\n\n')
        detailedFeedback = `${detailedFeedback}\n\nQuestion & Answer Summary:\n${qaSummary}`
      }
      
      // Include authorship analysis in detailed feedback if suspicious
      if (authenticityData.ai_suspicion && authenticityData.reasoning) {
        detailedFeedback = `${detailedFeedback}\n\n⚠️ AI Authorship Analysis:\nAuthenticity Score: ${authenticityData.authenticity_score}/100\nReasoning: ${authenticityData.reasoning}\nFlagged Features: ${authenticityData.flagged_features.join(", ")}`
      }
      
      await sql`
        INSERT INTO codebench_submissions (
          student_id, assignment_id, code, score, points_awarded, feedback, detailed_feedback, status, classroom_point_id,
          authenticity_score, ai_likelihood, authorship_reasoning, flagged_features, ai_suspicion, submitted_at
        )
        VALUES (
          ${numericStudentId}, 
          ${assignmentId || null}, 
          ${code}, 
          ${normalizedScore},
          ${finalPoints},
          ${`Score: ${normalizedScore.toFixed(1)}/10`},
          ${detailedFeedback}, 
          ${statusToUse}, 
          ${classroomPointId || null},
          ${authenticityData.authenticity_score},
          ${authenticityData.ai_likelihood},
          ${authenticityData.reasoning},
          ${authenticityData.flagged_features.length > 0 ? authenticityData.flagged_features : null},
          ${authenticityData.ai_suspicion},
          NOW()
        )
        ON CONFLICT (student_id, assignment_id) 
        DO UPDATE SET 
          code = ${code},
          score = ${normalizedScore},
          points_awarded = ${finalPoints},
          feedback = ${`Score: ${normalizedScore.toFixed(1)}/10`},
          detailed_feedback = ${detailedFeedback},
          status = ${statusToUse},
          classroom_point_id = ${classroomPointId || null},
          authenticity_score = ${authenticityData.authenticity_score},
          ai_likelihood = ${authenticityData.ai_likelihood},
          authorship_reasoning = ${authenticityData.reasoning},
          flagged_features = ${authenticityData.flagged_features.length > 0 ? authenticityData.flagged_features : null},
          ai_suspicion = ${authenticityData.ai_suspicion},
          submitted_at = NOW()
      `
      
      // Update classroom_points status if AI suspicion is high
      if (authenticityData.ai_suspicion && classroomPointId) {
        await sql`
          UPDATE classroom_points
          SET status = 'needs_review'
          WHERE id = ${classroomPointId}
        `
      }

      // Award badges directly (no internal HTTP fetch)
      const { checkAndAwardBadges } = await import("@/lib/codebench-badges")
      checkAndAwardBadges(student.id).catch((err) => console.error("[CodeBench Submit] Badges:", err))

      // Generate and save learning report (background, non-blocking)
      try {
        const submissionResult = await sql`
          SELECT id FROM codebench_submissions 
          WHERE student_id = ${numericStudentId} 
            AND assignment_id = ${assignmentId || null}
            AND submitted_at IS NOT NULL
          ORDER BY submitted_at DESC
          LIMIT 1
        `
        if (submissionResult[0]?.id) {
          const reportData = await sql`SELECT generate_codebench_report(${submissionResult[0].id}) as report`
          if (reportData[0]?.report) {
            await sql`
              SELECT save_learning_report(
                ${numericStudentId}::INTEGER,
                'codebench'::VARCHAR,
                ${submissionResult[0].id}::INTEGER,
                ${reportData[0].report}::JSONB
              )
            `
          }
        }
      } catch (reportError) {
        // Report generation failed (non-critical)
        console.error("[CodeBench Submit] Report generation failed:", reportError)
      }

      return NextResponse.json({
        success: true,
        message: "Code submitted and evaluated. Points pending instructor approval.",
        pointBooster: 2,
        boosterLabel: "x2 (CodeBench booster)",
        evaluation: {
          score: normalizedScore,
          maxScore: 10,
          pointsAwarded: finalPoints,
          codeSubmissionPoints: 2.5,
          evaluationPoints: evaluationPoints,
          maxPoints: 5.0,
          feedback: detailedFeedback,
          status: "pending",
        },
      })
    }

    // If answers provided, evaluate them and create pending classroom point
    if (answers && Array.isArray(answers)) {
      // Evaluate answers using AI
      if (!isOpenAIConfigured || !openai) {
        return NextResponse.json(
          { error: "AI evaluation is not configured" },
          { status: 500 }
        )
      }

      // Generate questions directly
      const { content: questionsContent } = await createForFeature(openai, "codebench", {

        messages: [
          {
            role: "system",
            content: `You are an expert programming educator. Generate 3-5 comprehension questions to test if a student understands their code.

Generate questions that test:
1. Understanding of code logic and flow
2. Knowledge of concepts used
3. Ability to predict output
4. Understanding of data structures/algorithms used

Format your response as JSON:
{
  "questions": [
    {
      "question": "What does this code do?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option B",
      "explanation": "Brief explanation"
    }
  ]
}

Mix multiple choice and short answer questions. Ensure questions are directly related to the student's code.`,
          },
          {
            role: "user",
            content: `Generate comprehension questions for this cpp code:\n\n\`\`\`cpp\n${code}\n\`\`\``,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      })

      let questionsData
      try {
        questionsData = JSON.parse(questionsContent || "{}")
      } catch (parseError) {
        console.error("[CodeBench Submit] Questions parse error:", parseError)
        return NextResponse.json(
          { error: "Failed to generate questions" },
          { status: 500 }
        )
      }

      const questions = questionsData.questions || []

      // Evaluate answers
      const { content: evaluationContent } = await createForFeature(openai, "codebench", {

        messages: [
          {
            role: "system",
            content: `You are an expert programming educator. Evaluate student answers to comprehension questions.

For each question, determine if the answer is correct or partially correct.
Score: 0-100 (100 = fully correct, 50-99 = partially correct, 0-49 = incorrect)

Format response as JSON:
{
  "scores": [85, 90, 75, 100],
  "totalScore": 87.5,
  "feedback": "Overall feedback on comprehension"
}

Be lenient but accurate. Partial credit for partially correct answers.`,
          },
          {
            role: "user",
            content: `Questions and student answers:\n\n${JSON.stringify(
              questions.map((q: any, i: number) => ({
                question: q.question,
                correctAnswer: q.correctAnswer,
                studentAnswer: answers[i] || "",
              })),
              null,
              2
            )}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      })

      let evaluationResult
      try {
        evaluationResult = JSON.parse(evaluationContent || "{}")
      } catch (parseError) {
        console.error("[CodeBench Submit] Evaluation parse error:", parseError)
        return NextResponse.json(
          { error: "Failed to parse evaluation" },
          { status: 500 }
        )
      }

      const scores = evaluationResult.scores || []
      const totalScore = evaluationResult.totalScore || 0
      const feedback = evaluationResult.feedback || ""

      // Calculate points based on score
      // - Code submission points: 2.5 points (50% - always awarded for submitting code)
      // - Evaluation points: (totalScore / 100) * 2.5 points (50% - max 2.5 points for evaluation)
      // - Total: 2.5 (submission) + up to 2.5 (evaluation) = max 5.0 points
      const codeSubmissionPoints = 2.5 // Always award for code submission (50%)
      const evaluationPoints = (totalScore / 100) * 2.5 // Evaluation points based on score (50%)
      const awardedPoints = codeSubmissionPoints + evaluationPoints // Total points
      
      // Ensure points are always > 0 to satisfy database constraint
      // Minimum is 2.5 (code submission) even if evaluation score is 0
      const finalPoints = Math.max(2.5, parseFloat(awardedPoints.toFixed(2)))

      // Get default instructor ID (you may need to adjust this)
      const instructorResult = await sql`
        SELECT id FROM instructors LIMIT 1
      `
      const instructorId = instructorResult[0]?.id || 1

      // Ensure classroom_points table has status column
      await sql`
        ALTER TABLE classroom_points 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'approved'
      `
      
      // Try to change reason column to TEXT if it's VARCHAR(500) to support longer feedback
      try {
        await sql`
          ALTER TABLE classroom_points 
          ALTER COLUMN reason TYPE TEXT
        `
      } catch (error: any) {
        // Column might already be TEXT or migration might fail - that's okay, truncation will handle it
      }

      // Create pending classroom point entry
      // Truncate reason to 500 characters to avoid database errors (if column is still VARCHAR)
      const evaluationPart = totalScore > 0 
        ? `Evaluation Score: ${totalScore.toFixed(1)}%`
        : `Evaluation Score: 0% (No points for evaluation)`
      const reasonBase = `Code Submission - ${evaluationPart}`
      const feedbackText = feedback || (totalScore === 0 ? "Code submitted but evaluation questions answered incorrectly" : "Comprehension evaluation")
      const fullReason = `${reasonBase} - ${feedbackText}`
      const truncatedReason = fullReason.length > 500 
        ? `${reasonBase} - ${feedbackText.substring(0, 500 - reasonBase.length - 3)}...`
        : fullReason

      const pointResult = await sql`
        INSERT INTO classroom_points (
          student_id,
          points,
          reason,
          category,
          awarded_by,
          session,
          status
        ) VALUES (
          ${student.id},
          ${finalPoints},
          ${truncatedReason},
          'code_submission',
          ${instructorId},
          ${student.section},
          'pending'
        )
        RETURNING *
      `

      // Store submission with evaluation data
      await sql`
        CREATE TABLE IF NOT EXISTS codebench_submissions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          assignment_id INTEGER,
          code TEXT NOT NULL,
          questions JSONB,
          answers JSONB,
          scores JSONB,
          total_score DECIMAL(5,2),
          points_awarded DECIMAL(5,2),
          status VARCHAR(20) DEFAULT 'pending',
          submitted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(student_id, assignment_id)
        )
      `

      await sql`
        INSERT INTO codebench_submissions (
          student_id, assignment_id, code, questions, answers, scores, 
          total_score, points_awarded, status, submitted_at
        )
        VALUES (
          ${numericStudentId}, 
          ${assignmentId || null}, 
          ${code}, 
          ${JSON.stringify(questions)},
          ${JSON.stringify(answers)},
          ${JSON.stringify(scores)},
          ${totalScore},
          ${finalPoints},
          'pending',
          NOW()
        )
        ON CONFLICT (student_id, assignment_id) 
        DO UPDATE SET 
          code = ${code},
          questions = ${JSON.stringify(questions)},
          answers = ${JSON.stringify(answers)},
          scores = ${JSON.stringify(scores)},
          total_score = ${totalScore},
          points_awarded = ${finalPoints},
          status = 'pending',
          submitted_at = NOW()
      `

      // Award badges based on performance (async, don't wait)
      fetch(`${getBaseUrl()}/api/codebench/badges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: numericStudentId })
      }).catch(err => console.error("[CodeBench Submit] Failed to award badges:", err))

      return NextResponse.json({
        success: true,
        message: "Code submitted and evaluated. Points pending instructor approval.",
        evaluation: {
          totalScore,
          scores,
          feedback,
          pointsAwarded: finalPoints,
          codeSubmissionPoints: 2.5,
          evaluationPoints: evaluationPoints,
          status: "pending",
        },
      })
    } else {
      // Just store the submission (questions will be generated on client side)
      await sql`
        CREATE TABLE IF NOT EXISTS codebench_submissions (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL,
          assignment_id INTEGER,
          code TEXT NOT NULL,
          submitted_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(student_id, assignment_id)
        )
      `

      await sql`
        INSERT INTO codebench_submissions (student_id, assignment_id, code, submitted_at)
        VALUES (${numericStudentId}, ${assignmentId || null}, ${code}, NOW())
        ON CONFLICT (student_id, assignment_id) 
        DO UPDATE SET code = ${code}, submitted_at = NOW()
      `

      return NextResponse.json({
        success: true,
        message: "Code submitted successfully",
        needsEvaluation: true,
      })
    }
  } catch (error) {
    console.error("[CodeBench Submit] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit code" },
      { status: 500 }
    )
  }
}
