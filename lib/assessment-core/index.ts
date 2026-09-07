/**
 * Assessment Core Library
 * 
 * Shared logic for all assessment types (quizzes, homeworks, midsem, finals, etc.)
 * Provides data isolation while maintaining code reuse.
 */

// Database operations
export * from './db'
export type { AssessmentType } from './db'

// Evaluation
export * from './evaluate'
export type { EvaluationOptions } from './evaluate'

// Submission
export * from './submit'
export type { SubmitAnswerPayload, SubmitAnswerResult } from './submit'

// Grading
export * from './grading'
export type { GradeCalculation, SectionWeight } from './grading'

// Anti-cheat
export * from './antiCheat'
export type { AntiCheatConfig, ViolationData } from './antiCheat'

// Rendering
export * from './render'

