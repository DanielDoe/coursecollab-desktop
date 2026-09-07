/**
 * Client-safe grade utilities (pure functions, no Node.js/db imports)
 * Use this in client components. Use lib/grades.ts for server-side grade logic.
 */

/** Whole-letter grades for course-evaluation pass expectations (no +/-). */
export const PASS_EXPECTATION_GRADE_OPTIONS = ["A", "B", "C", "D", "F"] as const

export type PassExpectationGrade = (typeof PASS_EXPECTATION_GRADE_OPTIONS)[number]

export function isValidPassExpectationGrade(value: string): value is PassExpectationGrade {
  return (PASS_EXPECTATION_GRADE_OPTIONS as readonly string[]).includes(value)
}

/** Standard letter grades used for self-assessment and gradebook display. */
export const LETTER_GRADE_OPTIONS = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D+",
  "D",
  "D-",
  "F",
] as const

export type LetterGradeOption = (typeof LETTER_GRADE_OPTIONS)[number]

export function isValidLetterGrade(value: string): value is LetterGradeOption {
  return (LETTER_GRADE_OPTIONS as readonly string[]).includes(value)
}

export function calculateLetterGrade(score: number): string {
  if (score >= 97) return "A+"
  if (score >= 93) return "A"
  if (score >= 90) return "A-"
  if (score >= 87) return "B+"
  if (score >= 83) return "B"
  if (score >= 80) return "B-"
  if (score >= 77) return "C+"
  if (score >= 73) return "C"
  if (score >= 70) return "C-"
  if (score >= 67) return "D+"
  if (score >= 63) return "D"
  if (score >= 60) return "D-"
  return "F"
}
