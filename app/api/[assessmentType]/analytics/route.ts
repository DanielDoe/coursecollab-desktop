import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "@/lib/assessment-core/db"

export const dynamic = 'force-dynamic'

/**
 * GET /api/[assessmentType]/analytics
 * 
 * Get analytics for a specific assessment type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { assessmentType: string } }
) {
  try {
    const assessmentType = params.assessmentType as AssessmentType
    
    // Validate assessment type
    const validTypes: AssessmentType[] = ['quiz', 'homework', 'midsem', 'final', 'practice', 'points']
    if (!validTypes.includes(assessmentType)) {
      return NextResponse.json(
        { error: `Invalid assessment type: ${assessmentType}` },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const assessmentId = searchParams.get("assessmentId")
    const instructorId = searchParams.get("instructorId")
    const section = searchParams.get("section")

    const config = getAssessmentConfig(assessmentType)

    // Build query conditions
    let whereConditions = sql`WHERE 1=1`

    if (assessmentId && assessmentId !== "all") {
      whereConditions = sql`${whereConditions} AND att.${sql.unsafe(config.idColumn)} = ${Number(assessmentId)}`
    }

    if (instructorId) {
      whereConditions = sql`${whereConditions} AND a.created_by = ${Number(instructorId)}`
    }

    if (section && section !== "all") {
      whereConditions = sql`${whereConditions} AND s.section = ${section}`
    }

    // Get overall statistics
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT a.id) as total_assessments,
        COUNT(DISTINCT att.id) as total_attempts,
        COUNT(DISTINCT att.student_id) as unique_students,
        AVG(att.score) as average_score,
        MIN(att.score) as min_score,
        MAX(att.score) as max_score,
        STDDEV(att.score) as std_dev,
        COUNT(CASE WHEN att.completed_at IS NOT NULL THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN att.completed_at IS NULL THEN 1 END) as incomplete_attempts
      FROM ${sql.unsafe(config.tableName)} a
      LEFT JOIN ${sql.unsafe(config.attemptsTable)} att ON a.id = att.${sql.unsafe(config.idColumn)}
      LEFT JOIN students s ON att.student_id = s.id
      ${whereConditions}
    `

    // Get score distribution
    const distribution = await sql`
      SELECT 
        CASE 
          WHEN att.score >= 90 THEN 'A (90-100)'
          WHEN att.score >= 80 THEN 'B (80-89)'
          WHEN att.score >= 70 THEN 'C (70-79)'
          WHEN att.score >= 60 THEN 'D (60-69)'
          ELSE 'F (0-59)'
        END as grade_range,
        COUNT(*) as count
      FROM ${sql.unsafe(config.attemptsTable)} att
      JOIN ${sql.unsafe(config.tableName)} a ON att.${sql.unsafe(config.idColumn)} = a.id
      JOIN students s ON att.student_id = s.id
      ${whereConditions}
      AND att.completed_at IS NOT NULL
      GROUP BY grade_range
      ORDER BY grade_range
    `

    // Get top performers
    const topPerformers = await sql`
      SELECT 
        s.id as student_id,
        s.full_name,
        s.student_id as student_number,
        s.section,
        MAX(att.score) as best_score,
        COUNT(att.id) as attempt_count,
        AVG(att.score) as average_score
      FROM ${sql.unsafe(config.attemptsTable)} att
      JOIN students s ON att.student_id = s.id
      JOIN ${sql.unsafe(config.tableName)} a ON att.${sql.unsafe(config.idColumn)} = a.id
      ${whereConditions}
      AND att.completed_at IS NOT NULL
      GROUP BY s.id, s.full_name, s.student_id, s.section
      ORDER BY best_score DESC, average_score DESC
      LIMIT 10
    `

    // Get question-level analytics
    const questionStats = await sql`
      SELECT 
        q.id,
        q.question_text,
        q.question_type,
        COUNT(ans.id) as total_answers,
        COUNT(CASE WHEN ans.is_correct = true THEN 1 END) as correct_answers,
        ROUND(COUNT(CASE WHEN ans.is_correct = true THEN 1 END)::numeric / NULLIF(COUNT(ans.id), 0) * 100, 2) as accuracy_percentage,
        AVG(ans.points_earned) as avg_points_earned
      FROM ${sql.unsafe(config.questionsTable)} q
      LEFT JOIN ${sql.unsafe(config.answersTable)} ans ON q.id = ans.question_id
      JOIN ${sql.unsafe(config.attemptsTable)} att ON ans.attempt_id = att.id
      JOIN ${sql.unsafe(config.tableName)} a ON q.${sql.unsafe(config.idColumn)} = a.id
      ${assessmentId && assessmentId !== "all" 
        ? sql`WHERE a.id = ${Number(assessmentId)}`
        : sql`WHERE 1=1`
      }
      ${instructorId ? sql`AND a.created_by = ${Number(instructorId)}` : sql``}
      GROUP BY q.id, q.question_text, q.question_type
      ORDER BY q.id
    `

    const statsData = stats[0]

    return NextResponse.json({
      overall: {
        totalAssessments: Number(statsData.total_assessments) || 0,
        totalAttempts: Number(statsData.total_attempts) || 0,
        uniqueStudents: Number(statsData.unique_students) || 0,
        averageScore: Number(statsData.average_score) || 0,
        minScore: Number(statsData.min_score) || 0,
        maxScore: Number(statsData.max_score) || 0,
        stdDev: Number(statsData.std_dev) || 0,
        completedAttempts: Number(statsData.completed_attempts) || 0,
        incompleteAttempts: Number(statsData.incomplete_attempts) || 0,
        completionRate: statsData.total_attempts > 0 
          ? (Number(statsData.completed_attempts) / Number(statsData.total_attempts) * 100).toFixed(2)
          : 0
      },
      distribution: distribution.map((d: any) => ({
        gradeRange: d.grade_range,
        count: Number(d.count) || 0
      })),
      topPerformers: topPerformers.map((p: any) => ({
        studentId: p.student_id,
        fullName: p.full_name,
        studentNumber: p.student_number,
        section: p.section,
        bestScore: Number(p.best_score) || 0,
        attemptCount: Number(p.attempt_count) || 0,
        averageScore: Number(p.average_score) || 0
      })),
      questionStats: questionStats.map((q: any) => ({
        questionId: q.id,
        questionText: q.question_text,
        questionType: q.question_type,
        totalAnswers: Number(q.total_answers) || 0,
        correctAnswers: Number(q.correct_answers) || 0,
        accuracyPercentage: Number(q.accuracy_percentage) || 0,
        avgPointsEarned: Number(q.avg_points_earned) || 0
      }))
    })
  } catch (error: any) {
    console.error(`[${params.assessmentType} Analytics] Error:`, error)
    return NextResponse.json(
      { error: "Failed to fetch analytics", details: error.message },
      { status: 500 }
    )
  }
}

