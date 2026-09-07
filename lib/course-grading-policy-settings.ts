/**
 * Course-level grading policy knobs (stored in course_policies.grading_policy JSONB).
 */

import {
  DEFAULT_ASSESSMENT_PERKS_GRACE_DAYS_AFTER_DEADLINE,
  parseAssessmentPerksGraceDays,
} from "@/lib/assessment-perks-expiry"
import { parseUploadPointsMultiplier, DEFAULT_UPLOAD_POINTS_MULTIPLIER } from "@/lib/multi-part-grading-policy"

export type CourseGradingPolicyJson = {
  multi_part_upload_multiplier?: number
  /** Days after each assessment deadline that rollover / membership retakes remain valid (course-wide). */
  assessment_perks_grace_days_after_deadline?: number
  /** Auto-mark instructor results as finalized when display grade is 100% and nothing pending review. */
  auto_finalize_perfect_scores?: boolean
  [key: string]: unknown
}

export function parseCourseGradingPolicy(raw: unknown): CourseGradingPolicyJson {
  if (!raw || typeof raw !== "object") return {}
  return raw as CourseGradingPolicyJson
}

export function getCourseMultiPartUploadMultiplier(raw: unknown): number {
  const policy = parseCourseGradingPolicy(raw)
  return parseUploadPointsMultiplier(policy.multi_part_upload_multiplier)
}

export function getCourseAssessmentPerksGraceDaysAfterDeadline(raw: unknown): number {
  const policy = parseCourseGradingPolicy(raw)
  return parseAssessmentPerksGraceDays(policy.assessment_perks_grace_days_after_deadline)
}

export function getCourseAutoFinalizePerfectScores(raw: unknown): boolean {
  const policy = parseCourseGradingPolicy(raw)
  return policy.auto_finalize_perfect_scores === true
}

export function mergeCourseGradingPolicy(
  existing: unknown,
  patch: Partial<CourseGradingPolicyJson>,
): CourseGradingPolicyJson {
  const base = parseCourseGradingPolicy(existing)
  const next: CourseGradingPolicyJson = { ...base, ...patch }
  if (patch.multi_part_upload_multiplier !== undefined) {
    next.multi_part_upload_multiplier = parseUploadPointsMultiplier(patch.multi_part_upload_multiplier)
  }
  if (patch.assessment_perks_grace_days_after_deadline !== undefined) {
    next.assessment_perks_grace_days_after_deadline = parseAssessmentPerksGraceDays(
      patch.assessment_perks_grace_days_after_deadline,
    )
  }
  if (patch.auto_finalize_perfect_scores !== undefined) {
    next.auto_finalize_perfect_scores = Boolean(patch.auto_finalize_perfect_scores)
  }
  return next
}

export { DEFAULT_UPLOAD_POINTS_MULTIPLIER }
