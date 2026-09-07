/**
 * AI Evaluation Mode Configuration
 * Defines strictness levels for AI grading of code questions
 */

export type AIEvaluationMode = 'relaxed' | 'standard' | 'strict' | 'very_strict'

export interface EvaluationModeConfig {
  id: AIEvaluationMode
  label: string
  description: string
  bestFor: string
}

/**
 * AI Evaluation Modes with descriptions
 */
export const AI_EVALUATION_MODES: Record<AIEvaluationMode, EvaluationModeConfig> = {
  relaxed: {
    id: 'relaxed',
    label: 'Relaxed',
    description: 'Focuses on functionality; minor style issues ignored',
    bestFor: 'Homework, quizzes, practice assignments',
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Balanced evaluation of logic and code quality',
    bestFor: 'Regular quizzes, mid-term prep',
  },
  strict: {
    id: 'strict',
    label: 'Strict',
    description: 'Requires proper style, edge cases, and best practices',
    bestFor: 'Graded quizzes, exams',
  },
  very_strict: {
    id: 'very_strict',
    label: 'Very Strict',
    description: 'Professional standards: optimization, documentation required',
    bestFor: 'Final exams, advanced assessments',
  },
}

/**
 * Get default evaluation mode based on assessment type.
 * Homeworks and quizzes use relaxed for AI code-write evaluation;
 * standard is the general fallback for unknown types.
 */
export function getDefaultEvaluationMode(assessmentType: string): AIEvaluationMode {
  const type = assessmentType?.toLowerCase() || ''
  
  if (type === 'homework') return 'relaxed'
  if (type === 'quiz') return 'relaxed'
  if (type === 'mid_semester' || type === 'mid-semester') return 'strict'
  if (type === 'final') return 'very_strict'
  
  // Default fallback for unknown types
  return 'standard'
}
