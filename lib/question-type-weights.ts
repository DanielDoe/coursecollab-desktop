import { sql } from "@/lib/db"

export interface QuestionTypeWeight {
  id: number
  question_type: string
  assessment_type: string
  points_value: number
  percentage_weight: number
  evaluation_mode: string
  grading_mode: string
  updated_at: string
}

/**
 * Get question type weight configuration for a specific assessment type
 * Falls back to generic configuration if specific assessment type not found
 */
export async function getQuestionTypeWeight(
  questionType: string, 
  assessmentType: string
): Promise<QuestionTypeWeight | null> {
  try {
    // First try to get specific assessment type configuration
    const specificWeight = await sql`
      SELECT * FROM question_type_weights
      WHERE question_type = ${questionType}
      AND assessment_type = ${assessmentType}
      LIMIT 1
    `

    if (specificWeight.length > 0) {
      return specificWeight[0] as QuestionTypeWeight
    }

    // Fall back to generic configuration
    const genericWeight = await sql`
      SELECT * FROM question_type_weights
      WHERE question_type = ${questionType}
      AND assessment_type = 'generic'
      LIMIT 1
    `

    return genericWeight.length > 0 ? genericWeight[0] as QuestionTypeWeight : null
  } catch (error) {
    console.error("Error fetching question type weight:", error)
    return null
  }
}

/**
 * Get all question type weights for a specific assessment type
 */
export async function getQuestionTypeWeightsForAssessment(
  assessmentType: string
): Promise<QuestionTypeWeight[]> {
  try {
    const weights = await sql`
      SELECT * FROM question_type_weights
      WHERE assessment_type = ${assessmentType}
      ORDER BY question_type
    `

    return weights as QuestionTypeWeight[]
  } catch (error) {
    console.error("Error fetching question type weights for assessment:", error)
    return []
  }
}

/**
 * Apply question type weight configuration to a question
 * Returns the configured points, evaluation mode, and grading mode
 */
export async function applyQuestionTypeWeight(
  questionType: string,
  assessmentType: string,
  defaultPoints: number = 1
): Promise<{
  points: number
  evaluation_mode: string
  grading_mode: string
}> {
  const weightConfig = await getQuestionTypeWeight(questionType, assessmentType)
  
  if (weightConfig) {
    return {
      points: weightConfig.points_value,
      evaluation_mode: weightConfig.evaluation_mode,
      grading_mode: weightConfig.grading_mode
    }
  }

  // Fallback to default values if no configuration found
  return {
    points: defaultPoints,
    evaluation_mode: 'auto',
    grading_mode: 'graded'
  }
}

/**
 * Calculate total possible points for an assessment based on question type weights
 */
export async function calculateTotalPossiblePoints(
  questions: Array<{ question_type: string }>,
  assessmentType: string
): Promise<number> {
  let totalPoints = 0

  for (const question of questions) {
    const weightConfig = await applyQuestionTypeWeight(
      question.question_type,
      assessmentType
    )
    totalPoints += weightConfig.points
  }

  return totalPoints
}

/**
 * Normalize score to 100 points based on question type weights
 */
export async function normalizeScoreWithWeights(
  rawScore: number,
  questions: Array<{ question_type: string }>,
  assessmentType: string
): Promise<number> {
  const totalPossiblePoints = await calculateTotalPossiblePoints(questions, assessmentType)
  
  if (totalPossiblePoints === 0) return 0
  
  return Math.round((rawScore / totalPossiblePoints) * 100)
}
