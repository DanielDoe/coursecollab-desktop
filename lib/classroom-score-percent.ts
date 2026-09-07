import type { GradeCircuitSubmissionResult } from "@/lib/grade-circuit-submission-answer"

/**
 * Advisory AI rubric scores for classroom points (not used for final point calculation).
 * Final classroom credit uses submission-based full credit — see classroom-points-grading-policy.ts.
 */
export function classroomScorePercentFromCircuitGrade(
  grade: GradeCircuitSubmissionResult,
  expectedAnswer?: string | null,
): number {
  let pct = Number(grade.result.points ?? 0)
  if (!Number.isFinite(pct)) pct = 0
  pct = Math.max(0, Math.min(100, pct))

  const hasExpected = Boolean(expectedAnswer?.trim())
  const aiGraded = grade.aiFeedback?.circuitSubmissionAiGraded === true || grade.aiFeedback?.aiGraded === true

  if (hasExpected && aiGraded) {
    if (pct >= 70) return 100
    if (pct >= 50) return Math.max(pct, 85)
  }

  return pct
}

/** Code validation: full base credit when AI says submission matches assignment. */
export function classroomScorePercentFromCodeValidation(matches: boolean, pointsOutOf25: number): number {
  if (matches) return 100
  const ratio = Math.max(0, Math.min(2.5, Number(pointsOutOf25) || 0)) / 2.5
  return Math.round(ratio * 100)
}
