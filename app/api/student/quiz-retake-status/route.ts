import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getCompletedAttemptCount } from "@/lib/retake-utils"
import {
  groupQuestionsBySections,
  calculateWeightedScore,
  type SectionConfig,
} from "@/lib/assessment-sections"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const quizId = searchParams.get("quizId")

    if (!studentId || !quizId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Get quiz retake settings, section_config, and assessment_type for weighted scoring
    const quizSettings = await sql`
      SELECT 
        id,
        title,
        retake_enabled,
        retake_limit,
        retake_policy,
        review_before_retake,
        COALESCE(forfeit_retake_on_report_view, true) as forfeit_retake_on_report_view,
        section_config,
        assessment_type,
        available_until
      FROM quizzes
      WHERE id = ${quizId}
    `

    if (quizSettings.length === 0) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    }

    const quiz = quizSettings[0]

    // Get student database ID (studentId from params might be student_id string or database id)
    let studentDatabaseId: number
    try {
      // Try as database ID first
      studentDatabaseId = parseInt(studentId)
      const studentCheck = await sql`
        SELECT id FROM students WHERE id = ${studentDatabaseId} LIMIT 1
      `
      if (studentCheck.length === 0) {
        // Try as student_id string
        const studentCheckByCode = await sql`
          SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1
        `
        if (studentCheckByCode.length === 0) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }
        studentDatabaseId = studentCheckByCode[0].id
      }
    } catch (error) {
      // If parseInt fails, try as student_id string
      const studentCheckByCode = await sql`
        SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1
      `
      if (studentCheckByCode.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentDatabaseId = studentCheckByCode[0].id
    }

    // Get total questions count for the quiz
    const totalQuestionsResult = await sql`
      SELECT COUNT(*) as total_count
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
    `
    const totalQuestions = parseInt(totalQuestionsResult[0]?.total_count || 0)

    // Incomplete attempts NEVER count toward retake limit - we only use completed count

    // Get all COMPLETED attempts for this student and quiz with correct answer counts
    // CRITICAL: Only fetch completed attempts - incomplete attempts are not stored/historical
    const attempts = await sql`
      SELECT 
        qa.id,
        qa.attempt_number,
        qa.score,
        qa.total_questions,
        qa.started_at,
        qa.completed_at,
        qa.is_final_grade,
        qa.has_viewed_report,
        qa.auto_submitted,
        qa.violation_reason,
        COUNT(qans.id) FILTER (WHERE qans.is_correct = true) as questions_correct
      FROM quiz_attempts qa
      LEFT JOIN quiz_answers qans ON qans.attempt_id = qa.id
      WHERE qa.student_id = ${studentDatabaseId} 
        AND qa.quiz_id = ${quizId}
        AND qa.deleted_at IS NULL
        AND qa.completed_at IS NOT NULL
      GROUP BY qa.id, qa.attempt_number, qa.score, qa.total_questions, qa.started_at, qa.completed_at, qa.is_final_grade, qa.has_viewed_report, qa.auto_submitted, qa.violation_reason
      ORDER BY qa.attempt_number DESC
    `
    
    // All attempts returned are completed (filtered in SQL)
    const activeAttempts = attempts

    // All attempts are completed (filtered in SQL query)
    const hasViewedReport = activeAttempts.some((a) => a.has_viewed_report)
    const hasFinalGrade = activeAttempts.some((a) => a.is_final_grade)

    // Check retake eligibility - ONLY completed attempts count (single source of truth)
    const completedAttemptsCount = await getCompletedAttemptCount(studentDatabaseId, parseInt(quizId))
    const { canRetakeAssessment } = await import("@/lib/retake-utils")
    const { hasRetakeAccess } = await import("@/lib/retake-access")
    
    // Check if student has retake access (includes beta users, donations, and memberships)
    const hasRetakeAccessCheck = await hasRetakeAccess(studentDatabaseId)
    
    const { hasDeadlineExtensionForStudentQuiz } = await import("@/lib/deadline-extension")
    const { isBetaUser } = await import("@/lib/membership")
    const hasDeadlineExt = await hasDeadlineExtensionForStudentQuiz(
      studentDatabaseId,
      parseInt(quizId, 10),
    )
    const retakeCheck = await canRetakeAssessment(
      studentDatabaseId,
      parseInt(quizId),
      quiz.retake_limit,
      quiz.retake_enabled,
      completedAttemptsCount,
      undefined,
      {
        availableUntil: quiz.available_until,
        hasDeadlineExtension: hasDeadlineExt,
        bypassCalendarRetakeExpiry: await isBetaUser(studentDatabaseId),
      },
    )

    const overrideRow = await sql`
      SELECT additional_attempts FROM attempt_overrides
      WHERE student_id = ${studentDatabaseId} AND quiz_id = ${parseInt(quizId)}
        AND is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1
    `
    const hasAttemptOverride = (Number(overrideRow[0]?.additional_attempts) || 0) > 0
    const eligibleByPlanOrOverride = hasRetakeAccessCheck || hasAttemptOverride

    // Additional checks: upgraded membership or instructor/rollover override, report viewing
    // Allow retake only if:
    // 1. Explorer/Trailblazer/donation/beta OR attempt_overrides (e.g. rollover grant)
    // 2. Retake check passes (retake enabled, within limit, etc.)
    // 3. When forfeit_retake_on_report_view is true: student hasn't viewed report OR latest attempt was auto-submitted
    //    When forfeit_retake_on_report_view is false: report viewing does not forfeit (e.g., code-only quizzes)
    const forfeitOnReportView = Boolean(quiz.forfeit_retake_on_report_view ?? true)
    const latestAttempt = activeAttempts[0]
    const lastAttemptWasAutoSubmitted = Boolean(latestAttempt?.auto_submitted || latestAttempt?.violation_reason)
    const allowRetakeDespiteViewingReport = lastAttemptWasAutoSubmitted || !forfeitOnReportView
    const reportViewBlocksRetake = forfeitOnReportView && hasViewedReport && !lastAttemptWasAutoSubmitted
    const canRetake =
      eligibleByPlanOrOverride &&
      retakeCheck.canRetake &&
      (!hasViewedReport || allowRetakeDespiteViewingReport)
    const attemptsRemaining = retakeCheck.attemptsRemaining

    // retakeBlockReason: for custom student-facing alerts
    let retakeBlockReason: string | null = null
    if (!canRetake && eligibleByPlanOrOverride) {
      if (reportViewBlocksRetake) {
        retakeBlockReason = "retake_forfeited"
      } else if (retakeCheck.calendarRetakePerksExpired) {
        retakeBlockReason = "retake_calendar_expired"
      } else if (!retakeCheck.canRetake) {
        retakeBlockReason = "retake_max_attempts"
      }
    } else if (!canRetake && !eligibleByPlanOrOverride) {
      retakeBlockReason = "retake_no_access"
    }

    // Get total points for the quiz (for simple percentage when no section config)
    const totalPointsResult = await sql`
      SELECT SUM(COALESCE(max_points, points, 1)) as total_points
      FROM quiz_questions
      WHERE quiz_id = ${quizId}
    `
    const totalPoints = parseFloat(totalPointsResult[0]?.total_points || 0)

    const sectionConfig = quiz.section_config as SectionConfig[] | null | undefined
    const assessmentType = quiz.assessment_type ?? "quiz"
    const isSectionizedAssessment =
      assessmentType === "mid_semester" || assessmentType === "midsem" || assessmentType === "final"
    const useSectionWeighting =
      isSectionizedAssessment &&
      sectionConfig &&
      Array.isArray(sectionConfig) &&
      sectionConfig.length > 0 &&
      sectionConfig.some((s) => s.weight_percent && s.weight_percent > 0)

    // Calculate percentage for each completed attempt
    const attemptsWithPercentage = await Promise.all(
      activeAttempts.map(async (a) => {
        const score = parseFloat(a.score || 0)
        const totalQ = parseInt(a.total_questions || 0)
        let percentage: number

        if (useSectionWeighting) {
          // For weighted sections: compute weighted % from score breakdown (same as results API)
          const scoreBreakdown = await sql`
            SELECT 
              qq.id as question_id,
              COALESCE(qa.points_earned, 0) as points_earned,
              COALESCE(qq.max_points, qq.points, 1) as max_points,
              COALESCE(qq.points, 1) as points,
              qq.question_type
            FROM quiz_questions qq
            LEFT JOIN quiz_answers qa ON qa.question_id = qq.id AND qa.attempt_id = ${a.id}
            WHERE qq.quiz_id = ${quizId}
            ORDER BY qq.question_order ASC
          `
          const sections = groupQuestionsBySections(
            scoreBreakdown.map((q: any) => ({ question_type: q.question_type })),
            sectionConfig
          )
          const sectionScores = sections.map((s) => {
            let earned = 0
            let max = 0
            for (const idx of s.questionIndices) {
              const q = scoreBreakdown[idx] as any
              if (!q) continue
              earned += Number(q.points_earned ?? 0)
              max += Number(q.max_points ?? 1)
            }
            return { earned, max, weightPercent: s.weightPercent, title: s.title }
          }) as Array<{ earned: number; max: number; weightPercent: number; title: string }>
          percentage = Math.max(0, Math.round(calculateWeightedScore(sectionScores) * 10) / 10)
        } else if (totalQ === 100 && score <= 100) {
          // Mid-semester: score is already the percentage
          percentage = score
        } else if (totalPoints > 0) {
          const computed = (score / totalPoints) * 100
          percentage = computed > 100 && score <= 100 ? score : computed
        } else {
          percentage = 0
        }
        return {
          ...a,
          percentage: Math.round(percentage * 10) / 10
        }
      })
    )

    // Calculate final grade based on policy (all attempts are completed)
    let finalGrade = null
    if (attemptsWithPercentage.length > 0) {
      if (quiz.retake_policy === "best") {
        finalGrade = Math.max(...attemptsWithPercentage.map((a) => a.percentage))
      } else if (quiz.retake_policy === "average") {
        const sum = attemptsWithPercentage.reduce((acc, a) => acc + a.percentage, 0)
        finalGrade = sum / attemptsWithPercentage.length
      } else {
        // 'latest'
        finalGrade = attemptsWithPercentage[0].percentage
      }
    }

    // All attempts are completed (incomplete attempts are deleted)
    const completedAttempts = attemptsWithPercentage

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        retakeEnabled: quiz.retake_enabled,
        retakeLimit: quiz.retake_limit,
        retakePolicy: quiz.retake_policy,
        reviewBeforeRetake: quiz.review_before_retake,
      },
      // CRITICAL: Only return completed attempts to prevent showing incomplete sessions
      attempts: completedAttempts.map((a) => ({
        id: a.id,
        attemptNumber: a.attempt_number,
        score: parseFloat(a.score || 0),
        totalQuestions: totalQuestions, // Total questions in the quiz
        totalPoints: totalPoints, // Total points for percentage calculation
        questionsCorrect: parseInt(a.questions_correct || 0), // Number of correct answers
        percentage: a.percentage,
        startedAt: a.started_at,
        completedAt: a.completed_at,
        isFinalGrade: a.is_final_grade,
        hasViewedReport: a.has_viewed_report,
      })),
      canRetake,
      attemptsRemaining,
      calendarRetakePerksExpired: retakeCheck.calendarRetakePerksExpired ?? false,
      expiredRetakeSlots: retakeCheck.expiredRetakeSlots ?? null,
      finalGrade: finalGrade ? Math.round(finalGrade * 100) / 100 : null,
      hasViewedReport,
      hasRetakeAccess: hasRetakeAccessCheck, // Whether student has retake access (beta, donation, or membership)
      retakeBlockReason, // retake_forfeited | retake_calendar_expired | retake_max_attempts | retake_no_access
      forfeitRetakeOnReportView: Boolean(quiz.forfeit_retake_on_report_view ?? true),
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to check retake status" }, { status: 500 })
  }
}
