/**
 * Shared helpers for instructor total-score overrides across assessment types.
 */

import { assessmentUsesSectionWeightedGrade } from "@/lib/assessment-sections"

export type InstructorOverrideAssessmentKind =
  | "quiz"
  | "mid_semester"
  | "final"
  | "homework"
  | "practice"
  | "playground"

/** Map DB / API `assessment_type` strings to the kind used by override UI and API hints. */
export function normalizeAssessmentKindForOverride(
  raw: string | null | undefined
): InstructorOverrideAssessmentKind {
  const t = (raw || "quiz").toLowerCase().trim()
  if (t === "mid_semester" || t === "midsem") return "mid_semester"
  if (t === "final") return "final"
  if (t === "homework") return "homework"
  if (t === "practice") return "practice"
  if (t === "playground") return "playground"
  return "quiz"
}

/** Mid-semester exams store percentage (0–100) in `quiz_attempts.score` for listing UIs. */
export function isMidSemesterOverrideType(
  dbType: string | null | undefined,
  clientHint?: string | null | undefined
): boolean {
  const isMid = (s: string | null | undefined) => {
    const v = (s || "").toLowerCase().trim()
    return v === "mid_semester" || v === "midsem"
  }
  return isMid(dbType) || isMid(clientHint)
}

/**
 * True when results UIs show total score on a 0–100 (weighted course %) scale
 * (section_config with weights summing to 100%). Matches instructor/student view routes.
 */
export function usesWeightedPercentageDisplay(
  assessmentType: string | null | undefined,
  sectionConfig: unknown
): boolean {
  return assessmentUsesSectionWeightedGrade(assessmentType || "quiz", sectionConfig as never)
}
