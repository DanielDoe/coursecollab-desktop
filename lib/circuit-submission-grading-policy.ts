/**
 * Circuit submission AI grading policy: generous partial credit with a 60% floor
 * for viable solution attempts (e.g. 6/10 on a 10-point question).
 */

import {
  CIRCUIT_SUBMISSION_RUBRIC_KEYS,
  sumCircuitSubmissionRubricScores,
  type CircuitSubmissionRubric,
  type CircuitSubmissionRubricScores,
} from "@/lib/circuit-submission"

/** Minimum score fraction when the student submitted a viable worked solution. */
export const CIRCUIT_VIABLE_MIN_SCORE_FRACTION = 0.6

export function circuitViableMinimumPoints(maxPoints: number): number {
  const max = Math.max(0, Number(maxPoints) || 10)
  return parseFloat((CIRCUIT_VIABLE_MIN_SCORE_FRACTION * max).toFixed(2))
}

export function buildCircuitLeniencyPromptInstructions(maxPoints: number): string {
  const minPts = circuitViableMinimumPoints(maxPoints)
  return `LENIENCY & MINIMUM SCORE (MANDATORY — overrides harsh deductions elsewhere in this prompt)

Course policy for circuit homework uploads:
1. **Be very generous with partial credit.** Students earn credit for visible effort: labeled nodes, drawn diagrams, KCL/KVL setup, chosen method (node/mesh/supernode), intermediate algebra, and unit work — even when steps are incomplete, signs flip, or arithmetic is wrong.
2. **Minimum ${minPts}/${maxPoints} pts** when the upload shows a **viable attempt at THIS problem** (legible worked circuit analysis for the assigned question). Typical viable work includes any two of: correct-ish setup, recognizable method, substantive calculations, or an attempted final answer.
3. **Do NOT score below ${minPts}/${maxPoints}** for viable attempts because of: missing intermediate steps, messy handwriting, notation differences, sign errors, wrong final numeric answer, or incomplete supernode/KCL formatting — unless the submission is blank, unrelated, or clearly the wrong problem.
4. **Score 0** only when: no readable work, blank/irrelevant pages, nonsense, or a solution to a completely different problem with no analysis of the assigned circuit.
5. Set **"submissionViable"** in JSON: \`true\` if (2) applies; \`false\` only for (4).
6. When applying the minimum, still give honest feedback listing errors — the numeric floor does not mean the work is perfect.

Rubric guidance (generous):
- **Setup:** award most points when nodes/branches/sources are identified and a diagram or labeling is present.
- **Method:** award most points when KCL/KVL, supernode, or mesh/node analysis is attempted, even if equations are imperfect.
- **Calculations:** award partial credit for any shown algebra/substitution, even with mistakes.
- **Final answer:** award partial credit for any boxed or stated result tied to the method, even if wrong.`
}

export function isViableCircuitSubmissionAttempt(input: {
  submissionViable?: unknown
  rubricScores: CircuitSubmissionRubricScores
  totalScore: number
  feedback: string
  strengths: string[]
  /** When true, distrust model claims of "no student work" if uploads rendered successfully. */
  hasRenderedStudentUploads?: boolean
}): boolean {
  const falseEmptyClaim =
    input.hasRenderedStudentUploads === true &&
    looksLikeFalseEmptyStudentUploadFeedback(input.feedback)

  if (input.submissionViable === false && !falseEmptyClaim) return false
  if (input.submissionViable === true) return true

  const rubricSum = sumCircuitSubmissionRubricScores(input.rubricScores)
  if (rubricSum > 0) return true
  if (input.strengths.length > 0) return true
  if (input.totalScore > 0) return true

  const fb = input.feedback.trim().toLowerCase()
  if (fb.length >= 80) {
    const effortSignals = [
      "kcl",
      "kvl",
      "node",
      "mesh",
      "supernode",
      "circuit",
      "voltage",
      "current",
      "resist",
      "attempt",
      "work",
      "equation",
      "labeled",
      "diagram",
    ]
    if (effortSignals.some((s) => fb.includes(s))) return true
  }
  return false
}

/** Model sometimes grades only the question diagram and claims the student upload is empty. */
export function looksLikeFalseEmptyStudentUploadFeedback(feedback: string): boolean {
  const fb = feedback.trim().toLowerCase()
  if (!fb) return false
  const patterns = [
    "don't see any student work",
    "do not see any student work",
    "i don't see any student work",
    "no student work to grade",
    "no student work",
    "no solution attempt",
    "no solution uploaded",
    "only the problem statement",
    "only the circuit figure",
    "only the circuit diagram",
    "only the diagram",
    "only the problem statement and circuit",
    "no work to grade",
    "cannot award points",
    "if you upload your worked solution",
    "upload your worked solution",
  ]
  return patterns.some((p) => fb.includes(p))
}

export function shouldRetryCircuitVisionAfterMissedUpload(input: {
  studentUploadPageCount: number
  submissionViable?: boolean
  totalScore: number
  rubricScores: CircuitSubmissionRubricScores
  feedback: string
  errorType?: string
}): boolean {
  if (input.studentUploadPageCount <= 0) return false
  if (input.errorType) return false

  const rubricSum = sumCircuitSubmissionRubricScores(input.rubricScores)
  if (rubricSum > 0 && input.submissionViable !== false) return false

  if (input.submissionViable === false) return true
  if (
    input.totalScore === 0 &&
    rubricSum === 0 &&
    looksLikeFalseEmptyStudentUploadFeedback(input.feedback)
  ) {
    return true
  }
  return false
}

/** Raise total + rubric to the viable-attempt minimum, scaling categories proportionally. */
export function applyCircuitViableSubmissionFloor(
  rubricScores: CircuitSubmissionRubricScores,
  rubric: CircuitSubmissionRubric,
  totalScore: number,
  maxPoints: number,
): {
  rubricScores: CircuitSubmissionRubricScores
  totalScore: number
  floorApplied: boolean
} {
  const minScore = circuitViableMinimumPoints(maxPoints)
  if (totalScore <= 0 || totalScore >= minScore) {
    return { rubricScores, totalScore, floorApplied: false }
  }

  const keys = CIRCUIT_SUBMISSION_RUBRIC_KEYS.filter(
    (k) => (rubric[k] ?? 0) > 0 && typeof rubricScores[k] === "number",
  )
  if (keys.length === 0) {
    return { rubricScores, totalScore: minScore, floorApplied: true }
  }

  const currentSum = sumCircuitSubmissionRubricScores(rubricScores) || totalScore
  const scaled: CircuitSubmissionRubricScores = { ...rubricScores }

  for (const key of keys) {
    const max = rubric[key] ?? 0
    const val = Number(scaled[key])
    scaled[key] = Math.min(max, parseFloat(((val / currentSum) * minScore).toFixed(2)))
  }

  let newTotal = sumCircuitSubmissionRubricScores(scaled)
  let remainder = parseFloat((minScore - newTotal).toFixed(2))

  for (const key of keys) {
    if (remainder <= 1e-9) break
    const max = rubric[key] ?? 0
    const val = Number(scaled[key] ?? 0)
    const add = Math.min(remainder, max - val)
    if (add > 1e-9) {
      scaled[key] = parseFloat((val + add).toFixed(2))
      remainder = parseFloat((remainder - add).toFixed(2))
    }
  }

  newTotal = sumCircuitSubmissionRubricScores(scaled)
  if (newTotal > minScore + 1e-9) {
    const excess = parseFloat((newTotal - minScore).toFixed(2))
    for (let i = keys.length - 1; i >= 0 && excess > 1e-9; i--) {
      const key = keys[i]
      const val = Number(scaled[key] ?? 0)
      const sub = Math.min(val, excess)
      if (sub > 0) {
        scaled[key] = parseFloat((val - sub).toFixed(2))
      }
    }
  }

  return {
    rubricScores: scaled,
    totalScore: minScore,
    floorApplied: true,
  }
}

export function appendCircuitFloorNote(feedback: string, minScore: number, maxPoints: number): string {
  const note = `\n\n_Note: Course policy applies a minimum of ${minScore}/${maxPoints} pts when a substantive solution attempt is submitted. Your feedback above reflects areas to improve; the score reflects partial credit for your effort._`
  if (feedback.includes("Course policy applies a minimum")) return feedback
  return `${feedback.trim()}${note}`
}

/** Apply viable-attempt floor when reading stored AI scores for display (existing rows). */
export function applyCircuitDisplayScoreFloor(
  candidate: number,
  maxPoints: number,
  aiFeedback: Record<string, unknown> | null | undefined,
  rubric: CircuitSubmissionRubric = { setup: 3, method: 3, calculations: 2, final_answer: 2 },
): number {
  if (!aiFeedback || candidate <= 0) return candidate
  const minPts = circuitViableMinimumPoints(maxPoints)
  if (candidate >= minPts) return candidate

  const rubricRaw = aiFeedback.rubricScores ?? aiFeedback.rubricScoresPreview
  const rubricScores =
    rubricRaw && typeof rubricRaw === "object"
      ? (rubricRaw as CircuitSubmissionRubricScores)
      : {}

  const feedbackStr = typeof aiFeedback.feedback === "string" ? aiFeedback.feedback : ""
  const viable = isViableCircuitSubmissionAttempt({
    submissionViable: aiFeedback.submissionViable,
    rubricScores,
    totalScore: candidate,
    feedback: feedbackStr,
    strengths: Array.isArray(aiFeedback.strengths)
      ? (aiFeedback.strengths as unknown[]).map((s) => String(s))
      : [],
    hasRenderedStudentUploads: looksLikeFalseEmptyStudentUploadFeedback(feedbackStr),
  })
  if (!viable) return candidate

  return applyCircuitViableSubmissionFloor(rubricScores, rubric, candidate, maxPoints).totalScore
}
