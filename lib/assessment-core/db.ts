/**
 * Database Adapters for Assessment Types
 * 
 * Provides type-safe database operations for each assessment type
 * while maintaining data isolation between types.
 */

import { sql } from "@/lib/db"
import {
  QUIZ_QUESTION_BANK_JOIN,
  QUIZ_QUESTION_BANK_SELECT,
  resolveQuizQuestionsFromBank,
} from "@/lib/resolve-quiz-question-from-bank"

export type AssessmentType = 'quiz' | 'homework' | 'midsem' | 'final' | 'practice' | 'points'

interface AssessmentTableConfig {
  tableName: string
  questionsTable: string
  attemptsTable: string
  answersTable: string
  sessionAccessTable: string
  idColumn: string
}

const ASSESSMENT_CONFIGS: Record<AssessmentType, AssessmentTableConfig> = {
  quiz: {
    tableName: 'quizzes',
    questionsTable: 'quiz_questions',
    attemptsTable: 'quiz_attempts',
    answersTable: 'quiz_answers',
    sessionAccessTable: 'quiz_session_access',
    idColumn: 'quiz_id'
  },
  homework: {
    tableName: 'quizzes', // Homeworks are stored in quizzes table with assessment_type = 'homework'
    questionsTable: 'quiz_questions', // Shared table - questions linked by quiz_id = homework id
    attemptsTable: 'quiz_attempts', // Shared table - attempts linked by quiz_id = homework id
    answersTable: 'quiz_answers', // Shared table
    sessionAccessTable: 'quiz_session_access', // Shared table
    idColumn: 'quiz_id' // Use quiz_id column name even for homeworks
  },
  midsem: {
    tableName: 'quizzes', // Midsem exams are stored in quizzes table with assessment_type = 'mid_semester'
    questionsTable: 'quiz_questions', // Shared table
    attemptsTable: 'quiz_attempts', // Shared table
    answersTable: 'quiz_answers', // Shared table
    sessionAccessTable: 'quiz_session_access', // Shared table
    idColumn: 'quiz_id' // Use quiz_id column name
  },
  final: {
    tableName: 'quizzes', // Final exams are stored in quizzes table with assessment_type = 'final'
    questionsTable: 'quiz_questions', // Shared table
    attemptsTable: 'quiz_attempts', // Shared table
    answersTable: 'quiz_answers', // Shared table
    sessionAccessTable: 'quiz_session_access', // Shared table
    idColumn: 'quiz_id' // Use quiz_id column name
  },
  practice: {
    tableName: 'practice_assessments',
    questionsTable: 'quiz_questions', // Shared table
    attemptsTable: 'quiz_attempts', // Shared table
    answersTable: 'quiz_answers', // Shared table
    sessionAccessTable: 'quiz_session_access', // Shared table
    idColumn: 'quiz_id' // Use quiz_id column name
  },
  points: {
    tableName: 'classroom_points',
    questionsTable: 'quiz_questions', // Shared table
    attemptsTable: 'quiz_attempts', // Shared table
    answersTable: 'quiz_answers', // Shared table
    sessionAccessTable: 'quiz_session_access', // Shared table
    idColumn: 'quiz_id' // Use quiz_id column name
  }
}

/**
 * Normalize assessment type from database value to AssessmentType
 * Handles variations like 'mid_semester' -> 'midsem', 'finals' -> 'final', etc.
 */
export function normalizeAssessmentType(type: string | null | undefined): AssessmentType {
  if (!type) return 'quiz'
  
  const normalized = type.toLowerCase().trim()
  
  // Map database values to AssessmentType
  const mapping: Record<string, AssessmentType> = {
    'quiz': 'quiz',
    'homework': 'homework',
    'mid_semester': 'midsem',
    'midsem': 'midsem',
    'midsemester': 'midsem',
    'final': 'final',
    'finals': 'final',
    'final_exam': 'final',
    'practice': 'practice',
    'playground': 'points',
    'points': 'points'
  }
  
  return mapping[normalized] || 'quiz'
}

/**
 * Get table configuration for an assessment type
 */
export function getAssessmentConfig(type: AssessmentType): AssessmentTableConfig {
  return ASSESSMENT_CONFIGS[type]
}

/**
 * Fetch assessment by ID with row locking
 */
export async function getAssessmentById(
  type: AssessmentType,
  id: number,
  lock: boolean = false
) {
  const config = getAssessmentConfig(type)
  
  if (lock) {
    const result = await sql`
      SELECT * FROM ${sql.unsafe(config.tableName)}
      WHERE id = ${id} AND deleted_at IS NULL
      FOR UPDATE
    `
    return result[0] || null
  }
  
  const result = await sql`
    SELECT * FROM ${sql.unsafe(config.tableName)}
    WHERE id = ${id} AND deleted_at IS NULL
  `
  
  return result[0] || null
}

/**
 * Fetch questions for an assessment
 */
export async function getAssessmentQuestions(
  type: AssessmentType,
  assessmentId: number
) {
  const config = getAssessmentConfig(type)
  
  const questions = await sql`
    SELECT
      qq.*,
      ${sql.unsafe(QUIZ_QUESTION_BANK_SELECT)}
    FROM ${sql.unsafe(config.questionsTable)} qq
    ${sql.unsafe(QUIZ_QUESTION_BANK_JOIN)}
    WHERE ${sql.unsafe(`qq.${config.idColumn}`)} = ${assessmentId}
    ORDER BY qq.question_order ASC
  `

  return resolveQuizQuestionsFromBank(questions as Record<string, unknown>[])
}

/**
 * Create a new attempt with transaction safety
 */
function logCreateAttempt(phase: string, payload: Record<string, unknown>, level: "info" | "warn" | "error" = "info") {
  const line = JSON.stringify({
    tag: "[createAttempt]",
    phase,
    ts: new Date().toISOString(),
    ...payload,
  })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export async function createAttempt(
  type: AssessmentType,
  data: {
    assessmentId: number
    studentId: number
  }
) {
  const config = getAssessmentConfig(type)

  logCreateAttempt("start", {
    assessmentType: type,
    quizId: data.assessmentId,
    studentDbId: data.studentId,
  })
  
  // Check retake limits
  // Avoid SELECT ... FOR UPDATE here: Neon/serverless poolers often reject row locks
  // outside an explicit transaction, which surfaces as 500 "Failed to start assessment".
  const assessment = await getAssessmentById(type, data.assessmentId, false)
  if (!assessment) {
    logCreateAttempt("abort_assessment_missing", { assessmentType: type, quizId: data.assessmentId }, "warn")
    throw new Error('Assessment not found')
  }
  
  // Enforce per-assessment attempt caps for all quizzes (retake_enabled false = 1 attempt unless overrides).
  const { getCompletedAttemptCount, getEffectiveRetakeLimit, isCalendarPastDue } = await import("@/lib/retake-utils")
  const { hasDeadlineExtensionForStudentQuiz } = await import("@/lib/deadline-extension")
  const completedCount = await getCompletedAttemptCount(data.studentId, data.assessmentId)
  const quizRetakeEnabled = assessment.retake_enabled === true
  const pastDue = isCalendarPastDue(assessment.available_until ?? null)
  const hasExt = await hasDeadlineExtensionForStudentQuiz(data.studentId, data.assessmentId)
  if (pastDue && !hasExt && completedCount === 0) {
    const incomplete = await sql`
      SELECT 1 FROM quiz_attempts
      WHERE student_id = ${data.studentId}
        AND quiz_id = ${data.assessmentId}
        AND deleted_at IS NULL
        AND completed_at IS NULL
      LIMIT 1
    `
    if (incomplete.length === 0) {
      logCreateAttempt("abort_expired_no_incomplete", {
        quizId: data.assessmentId,
        studentDbId: data.studentId,
        completedCount,
      }, "warn")
      throw new Error("Assessment has expired")
    }
  }
  const { effectiveLimit } = await getEffectiveRetakeLimit(
    data.studentId,
    data.assessmentId,
    assessment.retake_limit ?? null,
    quizRetakeEnabled
  )
  const totalAllowed = effectiveLimit === null ? null : effectiveLimit + 1
  if (totalAllowed !== null && completedCount >= totalAllowed) {
    logCreateAttempt("abort_retake_limit", {
      quizId: data.assessmentId,
      studentDbId: data.studentId,
      completedCount,
      effectiveLimit,
      totalAllowed,
      quizRetakeEnabled,
    }, "warn")
    throw new Error('Retake limit reached')
  }

  // Get next attempt number
  const attemptNumberResult = await sql`
    SELECT COALESCE(MAX(attempt_number), 0) + 1 as next
    FROM ${sql.unsafe(config.attemptsTable)}
    WHERE ${sql.unsafe(config.idColumn)} = ${data.assessmentId}
    AND student_id = ${data.studentId}
  `
  
  const attemptNumber = Number(attemptNumberResult[0]?.next || 1)

  logCreateAttempt("limits_ok", {
    quizId: data.assessmentId,
    studentDbId: data.studentId,
    completedCount,
    effectiveLimit,
    totalAllowed,
    nextAttemptNumber: attemptNumber,
  })
  
  // Create attempt — use NOW() so Postgres never sees JS Date strings like "GMT-0500" (Neon rejects those).
  let attempt
  try {
    attempt = await sql`
    INSERT INTO ${sql.unsafe(config.attemptsTable)} (
      ${sql.unsafe(config.idColumn)}, student_id, started_at, attempt_number, is_final_grade, score, total_questions
    )
    VALUES (${data.assessmentId}, ${data.studentId}, NOW(), ${attemptNumber}, false, 0, 0)
    RETURNING id
  `
  } catch (insertErr) {
    logCreateAttempt("insert_failed", {
      quizId: data.assessmentId,
      studentDbId: data.studentId,
      attemptNumber,
      message: insertErr instanceof Error ? insertErr.message : String(insertErr),
    }, "error")
    throw insertErr
  }

  const row = attempt[0] as { id?: number } | undefined
  logCreateAttempt("insert_ok", {
    quizId: data.assessmentId,
    studentDbId: data.studentId,
    attemptId: row?.id ?? null,
    attemptNumber,
  })
  
  return attempt[0]
}

/**
 * Save answer with transaction safety
 */
export async function saveAnswer(
  type: AssessmentType,
  data: {
    attemptId: number
    questionId: number
    selectedAnswer: string | null
    isCorrect: boolean
    pointsEarned: number
    answerData?: any
    feedback?: string
    requiresReview?: boolean
    aiFeedback?: Record<string, unknown> | null
    /** Seconds spent on this question (for results report and avg stats) */
    timeSpentSeconds?: number | null
  }
) {
  const aiFeedbackJson =
    data.aiFeedback != null ? JSON.stringify(data.aiFeedback) : null
  const timeSpent = data.timeSpentSeconds != null && data.timeSpentSeconds >= 0 ? data.timeSpentSeconds : null
  const answerDataJson = data.answerData != null ? JSON.stringify(data.answerData) : null

  // All assessment types share quiz_answers — literal table name avoids sql.unsafe
  // inlining large JSON payloads (Neon path breaks on `{` in feedback/answers).
  const existing = await sql`
    SELECT id, ai_feedback, time_spent_seconds FROM quiz_answers
    WHERE attempt_id = ${data.attemptId} AND question_id = ${data.questionId}
    LIMIT 1
  `

  const saveParams = {
    selectedAnswer: data.selectedAnswer,
    isCorrect: data.isCorrect,
    pointsEarned: data.pointsEarned,
    answerDataJson,
    feedback: data.feedback || null,
    requiresReview: data.requiresReview || false,
    aiFeedbackJson,
    timeSpent,
    attemptId: data.attemptId,
    questionId: data.questionId,
  }

  if (existing.length > 0) {
    await sql`
      UPDATE quiz_answers
      SET
        selected_answer = ${saveParams.selectedAnswer},
        is_correct = ${saveParams.isCorrect},
        points_earned = ${saveParams.pointsEarned},
        answer_data = COALESCE(${saveParams.answerDataJson}::jsonb, answer_data::jsonb),
        feedback = ${saveParams.feedback},
        requires_review = ${saveParams.requiresReview},
        ai_feedback = COALESCE(${saveParams.aiFeedbackJson}::jsonb, ai_feedback::jsonb),
        time_spent_seconds = COALESCE(${saveParams.timeSpent}, time_spent_seconds),
        answered_at = NOW()
      WHERE attempt_id = ${saveParams.attemptId} AND question_id = ${saveParams.questionId}
    `
  } else {
    await sql`
      INSERT INTO quiz_answers (
        attempt_id, question_id, selected_answer, is_correct,
        points_earned, answer_data, feedback, requires_review, ai_feedback, time_spent_seconds
      )
      VALUES (
        ${saveParams.attemptId}, ${saveParams.questionId}, ${saveParams.selectedAnswer},
        ${saveParams.isCorrect}, ${saveParams.pointsEarned},
        ${saveParams.answerDataJson}::jsonb,
        ${saveParams.feedback}, ${saveParams.requiresReview},
        ${saveParams.aiFeedbackJson}::jsonb, ${saveParams.timeSpent}
      )
    `
  }
}

/**
 * Update attempt score with row locking
 */
export async function updateAttemptScore(
  type: AssessmentType,
  attemptId: number,
  score: number,
  totalQuestions: number,
  completedAt?: Date
) {
  const config = getAssessmentConfig(type)

  // Only set completed_at when explicitly finalizing — never pass bare JS Date objects
  // (Neon/Postgres reject strings like "GMT-0500" from Date.toString()).
  if (completedAt) {
    await sql`
      UPDATE ${sql.unsafe(config.attemptsTable)}
      SET
        score = ${score},
        total_questions = ${totalQuestions},
        completed_at = NOW()
      WHERE id = ${attemptId}
    `
    return
  }

  await sql`
    UPDATE ${sql.unsafe(config.attemptsTable)}
    SET
      score = ${score},
      total_questions = ${totalQuestions}
    WHERE id = ${attemptId}
  `
}

/**
 * Get attempt with answers
 */
export async function getAttemptWithAnswers(
  type: AssessmentType,
  attemptId: number
) {
  const config = getAssessmentConfig(type)
  
  const attempts = await sql`
    SELECT * FROM ${sql.unsafe(config.attemptsTable)}
    WHERE id = ${attemptId}
  `
  
  if (!attempts[0]) return null
  
  const answers = await sql`
    SELECT * FROM ${sql.unsafe(config.answersTable)}
    WHERE attempt_id = ${attemptId}
    ORDER BY question_id
  `
  
  return {
    attempt: attempts[0],
    answers
  }
}

/**
 * Get student's attempts for an assessment
 */
export async function getStudentAttempts(
  type: AssessmentType,
  assessmentId: number,
  studentId: number
) {
  const config = getAssessmentConfig(type)
  
  const attempts = await sql`
    SELECT * FROM ${sql.unsafe(config.attemptsTable)}
    WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
    AND student_id = ${studentId}
    ORDER BY attempt_number ASC
  `
  
  return attempts
}

/**
 * Check session access for an assessment
 */
export async function checkSessionAccess(
  type: AssessmentType,
  assessmentId: number,
  sessionId: number
): Promise<boolean> {
  const config = getAssessmentConfig(type)
  
  const access = await sql`
    SELECT is_active FROM ${sql.unsafe(config.sessionAccessTable)}
    WHERE ${sql.unsafe(config.idColumn)} = ${assessmentId}
    AND session_id = ${sessionId}
  `
  
  return access?.is_active === true
}

