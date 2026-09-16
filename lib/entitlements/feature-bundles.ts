import type { FeatureBundleId } from "@/lib/entitlements/types"
import type { MembershipFeatures } from "@/lib/membership-constants"
import { MEMBERSHIP_PLANS } from "@/lib/membership-constants"
import type { InstructorMembershipFeatures } from "@/lib/instructor-membership-constants"
import { getInstructorMembershipPlan } from "@/lib/instructor-membership-constants"

export type StudentLearningFeature =
  | "lectures"
  | "leaderboard"
  | "aiTutor"
  | "codeBench"
  | "codeBenchCora"
  | "earlyAccess"
  | "playgroundCredits"
  | "practiceHub"
  | "flashcards"
  | "studyPlans"
  | "notes"
  | "recommendations"
  | "masteryAnalytics"

/** Graded-assessment commercial perks — never apply unless course policy allows. */
export type GradedAssessmentPerk = "quizAttempts" | "assessmentRollover" | "saveAndFinishLater"

const TRAILBLAZER = MEMBERSHIP_PLANS.find((p) => p.id === "Trailblazer")!.features
const EXPLORER = MEMBERSHIP_PLANS.find((p) => p.id === "Explorer")!.features
const SCHOLAR = MEMBERSHIP_PLANS.find((p) => p.id === "Scholar")!.features

export function studentPlanFeatures(bundle: FeatureBundleId): MembershipFeatures {
  if (bundle === "student_trailblazer" || bundle === "institution_student_access") {
    return TRAILBLAZER
  }
  if (bundle === "student_explorer") return EXPLORER
  return SCHOLAR
}

export function instructorPlanFeatures(bundle: FeatureBundleId): InstructorMembershipFeatures {
  if (bundle === "instructor_teams" || bundle === "institution_instructor_access") {
    return getInstructorMembershipPlan("Teams").features
  }
  if (bundle === "instructor_pro") return getInstructorMembershipPlan("Pro").features
  return getInstructorMembershipPlan("Free").features
}

export function bundleGrantsStudentLearning(bundle: FeatureBundleId): boolean {
  return (
    bundle === "student_explorer" ||
    bundle === "student_trailblazer" ||
    bundle === "institution_student_access"
  )
}

export function bundleGrantsInstructorTeaching(bundle: FeatureBundleId): boolean {
  return (
    bundle === "instructor_pro" ||
    bundle === "instructor_teams" ||
    bundle === "institution_instructor_access"
  )
}

/** Display tier when institutional license sponsors student learning access. */
export const INSTITUTION_SPONSORED_STUDENT_TIER = "Trailblazer" as const

/** Display tier when institutional license sponsors instructor teaching access. */
export const INSTITUTION_SPONSORED_INSTRUCTOR_TIER = "Teams" as const

export function sponsoredFeatureTierForBundle(
  bundle: FeatureBundleId | null | undefined,
): string | null {
  if (bundle === "institution_student_access") return INSTITUTION_SPONSORED_STUDENT_TIER
  if (bundle === "institution_instructor_access") return INSTITUTION_SPONSORED_INSTRUCTOR_TIER
  return null
}

export const INSTITUTION_STUDENT_LEARNING_FEATURES: StudentLearningFeature[] = [
  "lectures",
  "leaderboard",
  "aiTutor",
  "codeBench",
  "codeBenchCora",
  "earlyAccess",
  "playgroundCredits",
  "practiceHub",
  "flashcards",
  "studyPlans",
  "notes",
  "recommendations",
  "masteryAnalytics",
]
