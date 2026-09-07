/**
 * Shared Grading Logic
 * 
 * Handles weighted point computation, late penalties,
 * and grade calculations for all assessment types.
 */

import { sql } from "@/lib/db"
import { getAssessmentConfig, type AssessmentType } from "./db"

export interface GradeCalculation {
  score: number
  totalQuestions: number
  percentage: number
  pointsEarned: number
  totalPoints: number
}

/**
 * Calculate grade for an attempt
 */
export async function calculateAttemptGrade(
  assessmentType: AssessmentType,
  attemptId: number
): Promise<GradeCalculation | null> {
  const config = getAssessmentConfig(assessmentType)

  const attempts = await sql`
    SELECT score, total_questions
    FROM ${sql.unsafe(config.attemptsTable)}
    WHERE id = ${attemptId}
  `

  if (!attempts[0]) return null
  const attempt = attempts[0]

  // Get total points from questions
  const pointsResults = await sql`
    SELECT 
      SUM(COALESCE(max_points, points, 1)) as total_points,
      SUM(points_earned) as earned_points
    FROM ${sql.unsafe(config.answersTable)} a
    JOIN ${sql.unsafe(config.questionsTable)} q ON a.question_id = q.id
    WHERE a.attempt_id = ${attemptId}
  `
  const pointsResult = pointsResults[0]

  const totalPoints = Number(pointsResult?.total_points) || attempt.total_questions
  const pointsEarned = Number(pointsResult?.earned_points) || attempt.score

  const score = Number(attempt.score) || 0
  const totalQuestions = Number(attempt.total_questions) || 1
  // CRITICAL FIX: Calculate percentage using points earned / total possible points
  // NOT using total_questions (count) - that's incorrect for partial credit scenarios
  const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0

  return {
    score,
    totalQuestions,
    percentage: Math.round(percentage * 100) / 100,
    pointsEarned,
    totalPoints
  }
}

/**
 * Apply late submission penalty
 */
export function applyLatePenalty(
  score: number,
  submittedAt: Date,
  dueDate: Date,
  penaltyPerDay: number = 0.1 // 10% per day
): number {
  if (submittedAt <= dueDate) {
    return score
  }

  const daysLate = Math.ceil(
    (submittedAt.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
  )

  const penalty = daysLate * penaltyPerDay
  const finalScore = score * (1 - Math.min(penalty, 1)) // Cap at 100% penalty

  return Math.max(0, finalScore) // Don't go below 0
}

/**
 * Calculate weighted grade across multiple assessments
 */
export interface SectionWeight {
  section: string
  weight: number // 0-1, should sum to 1.0
}

export function calculateWeightedGrade(
  grades: Array<{ section: string; score: number }>,
  weights: SectionWeight[]
): number {
  const weightMap = new Map(weights.map(w => [w.section, w.weight]))
  let totalWeightedScore = 0
  let totalWeight = 0

  for (const grade of grades) {
    const weight = weightMap.get(grade.section) || 0
    totalWeightedScore += grade.score * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0
}

/**
 * Get final grade based on retake policy
 */
export async function getFinalGrade(
  assessmentType: AssessmentType,
  assessmentId: number,
  studentId: number
): Promise<GradeCalculation | null> {
  const config = getAssessmentConfig(assessmentType)

  // Get retake policy
  const assessments = await sql`
    SELECT retake_policy
    FROM ${sql.unsafe(config.tableName)}
    WHERE id = ${assessmentId}
  `

  if (!assessments[0]) return null
  const assessment = assessments[0]

  const retakePolicy = assessment.retake_policy || 'latest'

  let finalAttempt

  if (retakePolicy === 'best') {
    const bests = await sql`
      SELECT id FROM ${sql.unsafe(config.attemptsTable)}
      WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
      AND student_id = ${studentId}
      ORDER BY score DESC, completed_at DESC
      LIMIT 1
    `
    finalAttempt = bests[0]
  } else if (retakePolicy === 'average') {
    // For average, calculate from all attempts
    const avgs = await sql`
      SELECT 
        ROUND(AVG(score)) as score,
        MAX(total_questions) as total_questions,
        MAX(id) as id
      FROM ${sql.unsafe(config.attemptsTable)}
      WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
      AND student_id = ${studentId}
    `
    const avg = avgs[0]
    if (avg) {
      return {
        score: Number(avg.score) || 0,
        totalQuestions: Number(avg.total_questions) || 1,
        percentage: Number(avg.total_questions) > 0 
          ? (Number(avg.score) / Number(avg.total_questions)) * 100 
          : 0,
        pointsEarned: Number(avg.score) || 0,
        totalPoints: Number(avg.total_questions) || 1
      }
    }
  } else {
    // Latest
    const latests = await sql`
      SELECT id FROM ${sql.unsafe(config.attemptsTable)}
      WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
      AND student_id = ${studentId}
      ORDER BY completed_at DESC
      LIMIT 1
    `
    finalAttempt = latests[0]
  }

  if (!finalAttempt) return null

  return calculateAttemptGrade(assessmentType, finalAttempt.id)
}

