/**
 * Shared Grading Utilities
 * 
 * This module provides reusable grading logic for all assessment types
 * (quizzes, homeworks, midsem exams, final exams, practice assessments, classroom points).
 * 
 * This ensures consistency across assessment types while maintaining data isolation.
 */

import { sql } from "@/lib/db"

export type RetakePolicy = 'best' | 'average' | 'latest'

export interface FinalGradeResult {
  finalScore: number
  finalPercentage: number
  attemptId: number
}

export interface AttemptStats {
  totalAttempts: number
  completedAttempts: number
  incompleteAttempts: number
  uniqueStudents: number
  averageScore: number
  minScore: number
  maxScore: number
  scoreStdDev: number
}

/**
 * Calculate final grade based on retake policy
 * Works for any assessment type with attempts table
 */
export async function calculateFinalGrade(
  assessmentType: 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points',
  studentId: number,
  assessmentId: number
): Promise<FinalGradeResult | null> {
  try {
    // Get retake policy from the appropriate table
    const retakePolicy = await getRetakePolicy(assessmentType, assessmentId)
    if (!retakePolicy) {
      return null
    }

    // Get attempts based on assessment type
    const attempts = await getAttempts(assessmentType, studentId, assessmentId)
    
    if (attempts.length === 0) {
      return null
    }

    switch (retakePolicy) {
      case 'best':
        return getBestAttempt(attempts)
      
      case 'average':
        return getAverageAttempt(attempts)
      
      case 'latest':
      default:
        return getLatestAttempt(attempts)
    }
  } catch (error) {
    console.error(`[GradeUtils] Error calculating final grade for ${assessmentType}:`, error)
    return null
  }
}

/**
 * Get retake policy from the appropriate assessment table
 */
async function getRetakePolicy(
  assessmentType: 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points',
  assessmentId: number
): Promise<RetakePolicy | null> {
  try {
    let tableName: string
    switch (assessmentType) {
      case 'quiz':
        tableName = 'quizzes'
        break
      case 'homework':
        tableName = 'homeworks'
        break
      case 'midsem':
        tableName = 'midsem_exams'
        break
      case 'final':
        tableName = 'final_exams'
        break
      case 'practice':
        tableName = 'practice_assessments'
        break
      case 'points':
        tableName = 'classroom_points'
        break
      default:
        return null
    }

    const result = await sql`
      SELECT retake_policy 
      FROM ${sql(tableName)}
      WHERE id = ${assessmentId}
    `

    if (result.length === 0) {
      return null
    }

    return (result[0].retake_policy as RetakePolicy) || 'latest'
  } catch (error) {
    console.error(`[GradeUtils] Error getting retake policy:`, error)
    return null
  }
}

/**
 * Get attempts from the appropriate attempts table
 */
async function getAttempts(
  assessmentType: 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points',
  studentId: number,
  assessmentId: number
): Promise<Array<{ id: number; score: number; totalQuestions: number; completedAt: Date | null }>> {
  try {
    let tableName: string
    let idColumn: string

    switch (assessmentType) {
      case 'quiz':
        tableName = 'quiz_attempts'
        idColumn = 'quiz_id'
        break
      case 'homework':
        tableName = 'homework_attempts'
        idColumn = 'homework_id'
        break
      case 'midsem':
        tableName = 'midsem_attempts'
        idColumn = 'midsem_id'
        break
      case 'final':
        tableName = 'final_attempts'
        idColumn = 'final_id'
        break
      case 'practice':
        tableName = 'practice_attempts'
        idColumn = 'practice_id'
        break
      case 'points':
        tableName = 'classroom_points_attempts'
        idColumn = 'points_id'
        break
      default:
        return []
    }

    const result = await sql`
      SELECT id, score, total_questions, completed_at
      FROM ${sql(tableName)}
      WHERE student_id = ${studentId} AND ${sql(idColumn)} = ${assessmentId}
      ORDER BY completed_at DESC NULLS LAST, id DESC
    `

    return result.map((row: any) => ({
      id: row.id,
      score: Number(row.score) || 0,
      totalQuestions: Number(row.total_questions) || 0,
      completedAt: row.completed_at
    }))
  } catch (error) {
    console.error(`[GradeUtils] Error getting attempts:`, error)
    return []
  }
}

/**
 * Get best attempt (highest score)
 */
function getBestAttempt(
  attempts: Array<{ id: number; score: number; totalQuestions: number; completedAt: Date | null }>
): FinalGradeResult {
  const best = attempts.reduce((best, current) => {
    if (current.score > best.score) return current
    if (current.score === best.score && current.completedAt && (!best.completedAt || current.completedAt > best.completedAt)) {
      return current
    }
    return best
  })

  const percentage = best.totalQuestions > 0 
    ? (best.score / best.totalQuestions) * 100 
    : 0

  return {
    finalScore: best.score,
    finalPercentage: Math.round(percentage * 100) / 100,
    attemptId: best.id
  }
}

/**
 * Get average of all attempts
 */
function getAverageAttempt(
  attempts: Array<{ id: number; score: number; totalQuestions: number; completedAt: Date | null }>
): FinalGradeResult {
  if (attempts.length === 0) {
    return { finalScore: 0, finalPercentage: 0, attemptId: 0 }
  }

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0)
  const totalQuestions = attempts[0].totalQuestions // All attempts should have same total
  const avgScore = totalScore / attempts.length
  const percentage = totalQuestions > 0 
    ? (avgScore / totalQuestions) * 100 
    : 0

  // Return the most recent attempt ID for reference
  const latestAttemptId = attempts[0].id

  return {
    finalScore: Math.round(avgScore * 100) / 100,
    finalPercentage: Math.round(percentage * 100) / 100,
    attemptId: latestAttemptId
  }
}

/**
 * Get latest attempt (most recently completed)
 */
function getLatestAttempt(
  attempts: Array<{ id: number; score: number; totalQuestions: number; completedAt: Date | null }>
): FinalGradeResult {
  if (attempts.length === 0) {
    return { finalScore: 0, finalPercentage: 0, attemptId: 0 }
  }

  const latest = attempts[0] // Already sorted by completed_at DESC
  const percentage = latest.totalQuestions > 0 
    ? (latest.score / latest.totalQuestions) * 100 
    : 0

  return {
    finalScore: latest.score,
    finalPercentage: Math.round(percentage * 100) / 100,
    attemptId: latest.id
  }
}

/**
 * Calculate attempt statistics for an assessment
 */
export async function calculateAttemptStats(
  assessmentType: 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points',
  assessmentId: number
): Promise<AttemptStats> {
  try {
    let attemptsTable: string
    let idColumn: string

    switch (assessmentType) {
      case 'quiz':
        attemptsTable = 'quiz_attempts'
        idColumn = 'quiz_id'
        break
      case 'homework':
        attemptsTable = 'homework_attempts'
        idColumn = 'homework_id'
        break
      case 'midsem':
        attemptsTable = 'midsem_attempts'
        idColumn = 'midsem_id'
        break
      case 'final':
        attemptsTable = 'final_attempts'
        idColumn = 'final_id'
        break
      case 'practice':
        attemptsTable = 'practice_attempts'
        idColumn = 'practice_id'
        break
      case 'points':
        attemptsTable = 'classroom_points_attempts'
        idColumn = 'points_id'
        break
      default:
        return getEmptyStats()
    }

    const result = await sql`
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed_attempts,
        COUNT(CASE WHEN completed_at IS NULL THEN 1 END) as incomplete_attempts,
        COUNT(DISTINCT student_id) as unique_students,
        COALESCE(AVG(score), 0) as average_score,
        COALESCE(MIN(score), 0) as min_score,
        COALESCE(MAX(score), 0) as max_score,
        COALESCE(STDDEV(score), 0) as score_std_dev
      FROM ${sql(attemptsTable)}
      WHERE ${sql(idColumn)} = ${assessmentId}
    `

    if (result.length === 0) {
      return getEmptyStats()
    }

    const row = result[0]
    return {
      totalAttempts: Number(row.total_attempts) || 0,
      completedAttempts: Number(row.completed_attempts) || 0,
      incompleteAttempts: Number(row.incomplete_attempts) || 0,
      uniqueStudents: Number(row.unique_students) || 0,
      averageScore: Number(row.average_score) || 0,
      minScore: Number(row.min_score) || 0,
      maxScore: Number(row.max_score) || 0,
      scoreStdDev: Number(row.score_std_dev) || 0
    }
  } catch (error) {
    console.error(`[GradeUtils] Error calculating attempt stats:`, error)
    return getEmptyStats()
  }
}

/**
 * Get empty stats object
 */
function getEmptyStats(): AttemptStats {
  return {
    totalAttempts: 0,
    completedAttempts: 0,
    incompleteAttempts: 0,
    uniqueStudents: 0,
    averageScore: 0,
    minScore: 0,
    maxScore: 0,
    scoreStdDev: 0
  }
}

/**
 * Verify anti-cheat violations
 * This can be shared across all assessment types
 */
export interface AntiCheatConfig {
  strictModeEnabled: boolean
  blockCopyPaste: boolean
  trackTabSwitches: boolean
  trackMouseMovement: boolean
  warnOnTabSwitch: boolean
  maxTabSwitches: number
  autoSubmitOnViolations: boolean
}

export interface ViolationData {
  tabSwitches: number
  copyPasteDetected: boolean
  mouseMovementDetected: boolean
  otherViolations?: string[]
}

/**
 * Check if anti-cheat violations should trigger auto-submit
 */
export function shouldAutoSubmitOnViolations(
  config: AntiCheatConfig,
  violations: ViolationData
): boolean {
  if (!config.autoSubmitOnViolations) {
    return false
  }

  if (config.trackTabSwitches && violations.tabSwitches > config.maxTabSwitches) {
    return true
  }

  if (config.blockCopyPaste && violations.copyPasteDetected) {
    return true
  }

  return false
}

/**
 * Calculate section weighting for final grades
 * This can be used across all assessment types
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

