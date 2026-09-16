import { sql } from "@/lib/db"
import { getEffectiveMembershipTier, hasActiveDonationTrial, isBetaUser } from "@/lib/membership"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import { isSingleSittingExamAssessmentDbType } from "@/lib/final-exam-policy"
import { isRegularAssessmentTypeForSemesterCutoff } from "@/lib/regular-assessments-cutoff"
import {
  assessmentPerksExpiredMessage,
  getPlatformDefaultAssessmentPerksGraceDays,
  isPastAssessmentPerksExpiry,
} from "@/lib/assessment-perks-expiry"
import { getAssessmentPerksGraceDaysForQuiz } from "@/lib/assessment-perks-grace-resolve"
import {
  getQuizCourseId,
  membershipAssessmentBenefitsAllowedForStudent,
} from "@/lib/assessment-privilege-governance"
import { isRegularAssessmentSemesterHardCloseBlockingStudent } from "@/lib/retake-access"

/** True when quizzes.available_until is in the past (student-local clock). */
export function isCalendarPastDue(availableUntil: Date | string | null | undefined): boolean {
  if (availableUntil == null) return false
  const t = new Date(availableUntil).getTime()
  if (Number.isNaN(t)) return false
  return t < Date.now()
}

/**
 * When set, retakes follow tier limits while the assessment is open or within the
 * perks grace window (deadline + N days). After that, rollover and membership retakes expire.
 */
export type RetakeCalendarContext = {
  availableUntil: Date | string | null | undefined
  hasDeadlineExtension: boolean
  bypassCalendarRetakeExpiry?: boolean
  /** From course grading policy; falls back to platform default when omitted. */
  perksGraceDaysAfterDeadline?: number
}

function applyRetakeCalendarGate(
  base: { canRetake: boolean; attemptsRemaining: number | null; reason?: string },
  calendar: RetakeCalendarContext | undefined,
): {
  canRetake: boolean
  attemptsRemaining: number | null
  reason?: string
  calendarRetakePerksExpired?: boolean
  expiredRetakeSlots?: number | null
} {
  if (!calendar || calendar.bypassCalendarRetakeExpiry === true) {
    return { ...base, calendarRetakePerksExpired: false }
  }

  const { availableUntil, hasDeadlineExtension, perksGraceDaysAfterDeadline } = calendar
  const graceDays = perksGraceDaysAfterDeadline ?? getPlatformDefaultAssessmentPerksGraceDays()

  // Before the posted deadline: normal tier retake limits apply.
  if (!isCalendarPastDue(availableUntil)) {
    return { ...base, calendarRetakePerksExpired: false }
  }

  // Active rollover / extension still inside the grace window (deadline + N days).
  if (hasDeadlineExtension && !isPastAssessmentPerksExpiry(availableUntil, new Date(), graceDays)) {
    return { ...base, calendarRetakePerksExpired: false }
  }

  // Grace period ended — block unused membership retakes and post-due access without extension.
  if (isPastAssessmentPerksExpiry(availableUntil, new Date(), graceDays)) {
    const expiredSlots =
      base.canRetake && base.attemptsRemaining != null && base.attemptsRemaining > 0
        ? base.attemptsRemaining
        : base.canRetake
          ? 1
          : null
    return {
      canRetake: false,
      attemptsRemaining: 0,
      reason: assessmentPerksExpiredMessage(graceDays),
      calendarRetakePerksExpired: true,
      expiredRetakeSlots: expiredSlots,
    }
  }

  // Between deadline and perks expiry: tier retakes still allowed (no rollover required yet).
  return { ...base, calendarRetakePerksExpired: false }
}

/**
 * SINGLE SOURCE OF TRUTH: Only COMPLETED attempts count toward retake limit.
 * Incomplete attempts (completed_at IS NULL) NEVER count - they are ignored.
 * Use this helper everywhere to avoid bugs where incomplete attempts block retakes.
 */
export async function getCompletedAttemptCount(studentId: number, quizId: number): Promise<number> {
  const result = await sql`
    SELECT COUNT(*)::int as count
    FROM quiz_attempts
    WHERE student_id = ${studentId}
      AND quiz_id = ${quizId}
      AND completed_at IS NOT NULL
      AND deleted_at IS NULL
  `
  return result[0]?.count ?? 0
}

/**
 * IMPORTANT: Retake limits are PER ASSESSMENT (per quiz/homework/exam), NOT global.
 * Each assessment has its own attempt count tracked separately.
 * 
 * Example: A student with Explorer membership (2 attempts) can take:
 * - Homework 1: 2 attempts
 * - Homework 2: 2 attempts  
 * - Quiz 1: 2 attempts
 * etc.
 * Mid-semester and finals are always single-attempt (membership does not add retakes).
 * 
 * Get the default retake limit based on student's membership/donation status
 * Returns: number of retakes allowed PER ASSESSMENT (0 = no retakes, NULL = unlimited)
 */
export async function getDefaultRetakeLimit(
  studentId: number,
  courseId?: number | null,
): Promise<number | null> {
  try {
    const membershipPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(studentId, courseId)
    if (!membershipPerksAllowed) {
      return 0
    }

    // Beta users get Trailblazer-level access (2 retakes = 3 total attempts)
    const isBeta = await isBetaUser(studentId)
    if (isBeta) {
      return 2 // 2 retakes = 3 total attempts
    }
    
    const tier = await getEffectiveMembershipTier(studentId)
    const hasDonationAccess = await hasActiveDonationTrial(studentId)
    
    // If student has active donation (within 14 days), grant 2 retakes (3 total attempts)
    if (hasDonationAccess) {
      return 2 // 2 retakes = 3 total attempts
    }
    
    // Otherwise, use membership tier limits
    const plan = MEMBERSHIP_PLANS.find((p) => p.id === tier)
    const maxAttempts = plan?.features.quizAttempts || 0
    
    // Convert maxAttempts to retake_limit:
    // - maxAttempts = 0 (Scholar): retake_limit = 0 (no retakes, 1 total attempt)
    // - maxAttempts = 2 (Explorer): retake_limit = 1 (1 retake, 2 total attempts)
    // - maxAttempts >= 3 (Trailblazer/donation): retake_limit = 2 (2 retakes, 3 total attempts)
    if (maxAttempts === 0) {
      return 0 // No retakes
    } else if (maxAttempts >= 3) {
      return 2 // 2 retakes = 3 total attempts
    } else {
      // For any other value, calculate: retake_limit = maxAttempts - 1
      return Math.max(0, maxAttempts - 1)
    }
  } catch (error) {
    // Default to no retakes on error
    return 0
  }
}

/**
 * Get the effective retake limit for a student on a specific assessment
 * Takes into account:
 * 1. Quiz's retake_limit (set by instructor, or default based on status)
 * 2. Student's membership/donation status
 * 3. Instructor override (additional_attempts)
 * 
 * Returns: effective retake_limit (0 = no retakes, NULL = unlimited)
 *
 * @param quizRetakeEnabled When false, instructor turned off retakes: base retakes = 0 (1 total attempt)
 *        before overrides; membership/donation retake benefits do NOT apply. Rollover/instructor
 *        attempt_overrides still add extra retakes on top of that base.
 *
 * Mid-semester & finals: single sitting — membership/donation never inflates the cap; only
 * instructor `attempt_overrides` can grant extra attempts (make-up exams).
 */
export async function getEffectiveRetakeLimit(
  studentId: number,
  quizId: number,
  quizRetakeLimit: number | null,
  /** Pass `quiz.retake_enabled === true` so null/false both mean retakes off at quiz level */
  quizRetakeEnabled: boolean
): Promise<{ effectiveLimit: number | null; hasOverride: boolean; overrideAdditionalAttempts: number }> {
  try {
    const typeRow = await sql`
      SELECT assessment_type FROM quizzes WHERE id = ${quizId} AND deleted_at IS NULL LIMIT 1
    `
    const at = (typeRow[0] as { assessment_type?: string } | undefined)?.assessment_type
    const platformDefault = getPlatformDefaultAssessmentPerksGraceDays()

    let instructorOverride: any[] = []
    try {
      instructorOverride = await sql`
        SELECT ao.additional_attempts, ao.expires_at
        FROM attempt_overrides ao
        INNER JOIN quizzes q ON q.id = ao.quiz_id AND q.deleted_at IS NULL
        LEFT JOIN course_policies cp ON cp.course_id = q.course_id
        WHERE ao.quiz_id = ${quizId}
          AND ao.student_id = ${studentId}
          AND ao.is_active = TRUE
          AND (ao.expires_at IS NULL OR ao.expires_at > NOW())
          AND (
            q.available_until IS NULL
            OR NOW() <= q.available_until + (
              COALESCE(
                NULLIF((cp.grading_policy->>'assessment_perks_grace_days_after_deadline')::int, -1),
                ${platformDefault}
              ) * INTERVAL '1 day'
            )
          )
        LIMIT 1
      `
    } catch (error) {
      // Table might not exist, ignore
    }

    const hasOverride = instructorOverride.length > 0
    const overrideAdditionalAttempts = hasOverride ? Number(instructorOverride[0].additional_attempts) || 0 : 0

    if (isSingleSittingExamAssessmentDbType(at)) {
      const effectiveLimit = Math.max(0, overrideAdditionalAttempts)
      return { effectiveLimit, hasOverride, overrideAdditionalAttempts }
    }

    const quizCourseId = await getQuizCourseId(quizId)
    // Get student's default retake limit based on their status and course governance
    const studentDefaultLimit = await getDefaultRetakeLimit(studentId, quizCourseId)
    const membershipPerksAllowed = await membershipAssessmentBenefitsAllowedForStudent(
      studentId,
      quizCourseId,
    )

    // When retakes are disabled on the quiz, instructor-only mode blocks membership retakes.
    // With membership_enabled / hybrid governance, tier retakes still apply on regular assessments.
    if (!quizRetakeEnabled) {
      if (membershipPerksAllowed && (studentDefaultLimit ?? 0) > 0) {
        let baseLimit = studentDefaultLimit
        if (quizRetakeLimit !== null && studentDefaultLimit !== null) {
          baseLimit = Math.max(quizRetakeLimit, studentDefaultLimit)
        } else if (quizRetakeLimit !== null) {
          baseLimit = quizRetakeLimit
        }
        const effectiveLimit =
          baseLimit === null ? null : Math.max(0, baseLimit + overrideAdditionalAttempts)
        return {
          effectiveLimit,
          hasOverride,
          overrideAdditionalAttempts,
        }
      }

      const effectiveLimit = Math.max(0, overrideAdditionalAttempts)
      return {
        effectiveLimit,
        hasOverride,
        overrideAdditionalAttempts,
      }
    }

    // IMPORTANT: Use the MAXIMUM of quiz's limit and student's benefit limit
    // This ensures students get the benefits they paid for (donation/membership)
    // while still allowing instructors to set higher limits if desired
    // 
    // Example: Quiz has retake_limit=1, but student has donation (2 retakes)
    // Result: Student gets 2 retakes (their paid benefit)
    //
    // Example: Quiz has retake_limit=3, student has donation (2 retakes)
    // Result: Student gets 3 retakes (quiz allows more)
    let baseLimit: number | null
    if (quizRetakeLimit !== null && studentDefaultLimit !== null) {
      // Both are set - use the maximum to give student the benefit of what they paid for
      baseLimit = Math.max(quizRetakeLimit, studentDefaultLimit)
    } else if (quizRetakeLimit !== null) {
      // Only quiz limit is set
      baseLimit = quizRetakeLimit
    } else if (studentDefaultLimit !== null) {
      // Only student limit is set (or quiz limit is null)
      baseLimit = studentDefaultLimit
    } else {
      // Both are null = unlimited
      baseLimit = null
    }
    
    // Apply instructor override (additional attempts)
    let effectiveLimit: number | null
    if (baseLimit === null) {
      // Unlimited retakes, override doesn't matter
      effectiveLimit = null
    } else {
      // Add override attempts to base limit
      effectiveLimit = baseLimit + overrideAdditionalAttempts
      // Don't allow negative
      effectiveLimit = Math.max(0, effectiveLimit)
    }
    
    return {
      effectiveLimit,
      hasOverride,
      overrideAdditionalAttempts,
    }
  } catch (error) {
    console.error("[Retake Utils] Error getting effective retake limit:", error)
    return {
      effectiveLimit: 0, // Default to no retakes on error
      hasOverride: false,
      overrideAdditionalAttempts: 0,
    }
  }
}

/**
 * Check if a student can retake an assessment
 * 
 * IMPORTANT: This checks retakes PER ASSESSMENT (per quiz/homework/exam).
 * Each assessment has its own attempt count. A student with 3 attempts can
 * take 3 attempts on EACH assessment, not 3 attempts total across all assessments.
 * 
 * @param studentId - Student database ID
 * @param quizId - Specific quiz/assessment ID (attempts are tracked per quiz_id)
 * @param quizRetakeLimit - Retake limit for THIS specific quiz (from quizzes table)
 * @param quizRetakeEnabled - Whether retakes are enabled for THIS quiz
 * @param completedAttempts - Number of COMPLETED attempts only (incomplete NEVER count - use getCompletedAttemptCount)
 * @param extraAttemptFromSuperpower - If true, student selected extra_retake superpower; grant +1 attempt
 * @param calendar - When provided, tier retakes after available_until require an active rollover/extension
 */
export async function canRetakeAssessment(
  studentId: number,
  quizId: number,
  quizRetakeLimit: number | null,
  quizRetakeEnabled: boolean,
  completedAttempts: number,
  extraAttemptFromSuperpower?: boolean,
  calendar?: RetakeCalendarContext
): Promise<{
  canRetake: boolean
  attemptsRemaining: number | null
  reason?: string
  calendarRetakePerksExpired?: boolean
  expiredRetakeSlots?: number | null
}> {
  try {
    const typeRowEarly = await sql`
      SELECT assessment_type, course_id FROM quizzes WHERE id = ${quizId} AND deleted_at IS NULL LIMIT 1
    `
    const atEarly = (typeRowEarly[0] as { assessment_type?: string; course_id?: number } | undefined)
      ?.assessment_type
    const quizCourseId =
      (typeRowEarly[0] as { course_id?: number } | undefined)?.course_id ?? (await getQuizCourseId(quizId))
    if (
      isRegularAssessmentTypeForSemesterCutoff(atEarly) &&
      (await isRegularAssessmentSemesterHardCloseBlockingStudent(studentId, quizCourseId))
    ) {
      return {
        canRetake: false,
        attemptsRemaining: 0,
        reason:
          "Retakes for quizzes and homework closed after the semester concluded. Contact your instructor if you need help.",
        calendarRetakePerksExpired: true,
        expiredRetakeSlots: null,
      }
    }

    let resolvedCalendar = calendar
    if (calendar && calendar.perksGraceDaysAfterDeadline == null) {
      const graceDays = await getAssessmentPerksGraceDaysForQuiz(quizId)
      resolvedCalendar = { ...calendar, perksGraceDaysAfterDeadline: graceDays }
    }

    if (isSingleSittingExamAssessmentDbType(atEarly)) {
      const { effectiveLimit } = await getEffectiveRetakeLimit(
        studentId,
        quizId,
        quizRetakeLimit,
        false,
      )
      const retakesAllowed = Math.max(0, effectiveLimit ?? 0)
      const retakesUsed = Math.max(0, completedAttempts - 1)
      const attemptsRemaining = Math.max(0, retakesAllowed - retakesUsed)
      const totalAttemptsAllowed = 1 + retakesAllowed
      const canRetake =
        retakesAllowed > 0 &&
        completedAttempts >= 1 &&
        completedAttempts < totalAttemptsAllowed
      return applyRetakeCalendarGate(
        {
          canRetake,
          attemptsRemaining,
          reason: canRetake ? undefined : "Final and mid-semester exams allow one attempt only",
        },
        resolvedCalendar,
      )
    }

    const retakeOn = quizRetakeEnabled === true
    // Get effective retake limit (retake_enabled=false uses base 0 + overrides only)
    const { effectiveLimit } = await getEffectiveRetakeLimit(
      studentId,
      quizId,
      quizRetakeLimit,
      retakeOn
    )

    let superpowerExtraRetake = extraAttemptFromSuperpower === true
    if (superpowerExtraRetake) {
      const tr = await sql`
        SELECT assessment_type FROM quizzes WHERE id = ${quizId} AND deleted_at IS NULL LIMIT 1
      `
      const at = (tr[0] as { assessment_type?: string } | undefined)?.assessment_type
      if (isSingleSittingExamAssessmentDbType(at)) superpowerExtraRetake = false
    }
    
    // Calculate total attempts allowed for THIS assessment (retake_limit + 1)
    // Note: This is per assessment, not global across all assessments
    // Superpower extra_retake grants +1 attempt
    let totalAttemptsAllowed: number | null = effectiveLimit === null ? null : effectiveLimit + 1
    if (totalAttemptsAllowed !== null && superpowerExtraRetake) {
      totalAttemptsAllowed += 1
    }
    
    // Check if student has exceeded the limit for THIS specific assessment
    if (effectiveLimit === null) {
      // Unlimited retakes for this assessment
      return applyRetakeCalendarGate(
        {
          canRetake: true,
          attemptsRemaining: null,
        },
        resolvedCalendar,
      )
    } else {
      // Retakes remaining (not including the initial attempt). UI labels this as "N retakes left".
      // Example: Trailblazer effectiveLimit=2, completed=0 → 2 retakes left (first attempt still unused).
      const retakesAllowed = Math.max(0, effectiveLimit)
      const retakesUsed = Math.max(0, completedAttempts - 1)
      const attemptsRemaining = Math.max(0, retakesAllowed - retakesUsed)
      // canRetake here means "may start/continue an attempt" (first attempt or a retake).
      const canRetake = completedAttempts < (totalAttemptsAllowed as number)

      return applyRetakeCalendarGate(
        {
          canRetake,
          attemptsRemaining,
          reason: canRetake ? undefined : "Maximum attempts reached for this assessment",
        },
        resolvedCalendar,
      )
    }
  } catch (error) {
    return {
      canRetake: false,
      attemptsRemaining: 0,
      reason: "Error checking retake eligibility",
    }
  }
}

