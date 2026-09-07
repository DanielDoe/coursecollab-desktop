export type InstructorMembershipTier = "Free" | "Pro" | "Teams"
/** Legacy stored/Stripe value. Canonical public tier is Teams. */
export type LegacyInstructorEnterpriseTier = "Enterprise"

const TIER_ALIASES: Record<string, InstructorMembershipTier> = {
  free: "Free",
  instructor_free: "Free",
  pro: "Pro",
  instructor_pro: "Pro",
  teams: "Teams",
  instructor_teams: "Teams",
  enterprise: "Teams",
  instructor_enterprise: "Teams",
}

export function normalizeInstructorMembershipTier(raw: unknown): InstructorMembershipTier | null {
  if (raw == null) return null
  const key = String(raw).trim().toLowerCase()
  if (!key) return null
  return TIER_ALIASES[key] ?? null
}

/** True when the persisted DB/Stripe value is still the pre-rename Enterprise label. */
export function isLegacyInstructorEnterpriseTier(raw: unknown): boolean {
  const key = String(raw ?? "").trim().toLowerCase()
  return key === "enterprise" || key === "instructor_enterprise"
}

export function isPaidInstructorTier(tier: InstructorMembershipTier | string | null | undefined): boolean {
  const normalized = normalizeInstructorMembershipTier(tier)
  return normalized === "Pro" || normalized === "Teams"
}

export interface InstructorMembershipFeatures {
  maxCourses: number | "unlimited"
  maxStudents: number | "unlimited"
  /** Semester (or annual) Cora Credits pool — not request counts. */
  coraCreditsPerPeriod: number
  /** @deprecated use coraCreditsPerPeriod */
  coraAiRequestsPerSemester: number
  basicAssessmentManagement: boolean
  questionBank: boolean
  manualContentCreation: boolean
  basicGradingTools: boolean
  fullCoraTeachingCopilot: boolean
  aiQuestionGenerator: boolean
  aiQuizGenerator: boolean
  aiHomeworkGenerator: boolean
  aiMidtermGenerator: boolean
  aiFinalExamGenerator: boolean
  aiLectureSlideGenerator: boolean
  aiFlashcardGenerator: boolean
  aiRubricGenerator: boolean
  aiAnnouncementGenerator: boolean
  aiCourseNotesGenerator: boolean
  aiPracticeProblemGenerator: boolean
  aiGradingAssistance: boolean
  aiFeedbackGenerator: boolean
  studentRiskDetection: boolean
  courseAnalytics: boolean
  interactiveQuestionBuilder: boolean
  aiAssessmentReview: boolean
  officeHourAssistant: boolean
  recommendationLetterAssistant: boolean
  exportFormats: boolean
  priorityAiModels: boolean
  prioritySupport: boolean
  multipleInstructors: boolean
  sharedQuestionBanks: boolean
  sharedCoraKnowledgeBase: boolean
  departmentAiResources: boolean
  /** Team/multi-section analytics. Campus-wide reporting is institutional. */
  departmentAnalytics: boolean
  /** Relocated to institutional licenses. Kept false on individual Teams. */
  crossCourseAnalytics: boolean
  sharedAssessmentLibraries: boolean
  teachingAssistantManagement: boolean
  departmentTemplates: boolean
  /** Relocated to institutional licenses. */
  accreditationReportGeneration: boolean
  /** Relocated to institutional licenses. */
  institutionalAssessmentReports: boolean
  collaborativeCourseAuthoring: boolean
  advancedPermissionsWorkflows: boolean
  dedicatedOnboarding: boolean
}

export interface InstructorMembershipPlan {
  id: InstructorMembershipTier
  name: string
  displayName: string
  tagline: string
  semesterPriceInCents: number
  annualPriceInCents: number
  description: string
  features: InstructorMembershipFeatures
  featureBullets: string[]
  badge: string
  color: string
  recommended?: boolean
}

const FREE_FEATURES: InstructorMembershipFeatures = {
  maxCourses: 1,
  maxStudents: 50,
  coraCreditsPerPeriod: 500,
  coraAiRequestsPerSemester: 500,
  basicAssessmentManagement: true,
  questionBank: true,
  manualContentCreation: true,
  basicGradingTools: true,
  fullCoraTeachingCopilot: false,
  aiQuestionGenerator: false,
  aiQuizGenerator: false,
  aiHomeworkGenerator: false,
  aiMidtermGenerator: false,
  aiFinalExamGenerator: false,
  aiLectureSlideGenerator: false,
  aiFlashcardGenerator: false,
  aiRubricGenerator: false,
  aiAnnouncementGenerator: false,
  aiCourseNotesGenerator: false,
  aiPracticeProblemGenerator: false,
  aiGradingAssistance: false,
  aiFeedbackGenerator: false,
  studentRiskDetection: false,
  courseAnalytics: false,
  interactiveQuestionBuilder: false,
  aiAssessmentReview: false,
  officeHourAssistant: false,
  recommendationLetterAssistant: false,
  exportFormats: false,
  priorityAiModels: false,
  prioritySupport: false,
  multipleInstructors: false,
  sharedQuestionBanks: false,
  sharedCoraKnowledgeBase: false,
  departmentAiResources: false,
  departmentAnalytics: false,
  crossCourseAnalytics: false,
  sharedAssessmentLibraries: false,
  teachingAssistantManagement: false,
  departmentTemplates: false,
  accreditationReportGeneration: false,
  institutionalAssessmentReports: false,
  collaborativeCourseAuthoring: false,
  advancedPermissionsWorkflows: false,
  dedicatedOnboarding: false,
}

const PRO_FEATURES: InstructorMembershipFeatures = {
  ...FREE_FEATURES,
  maxCourses: "unlimited",
  maxStudents: "unlimited",
  coraCreditsPerPeriod: 15000,
  coraAiRequestsPerSemester: 15000,
  fullCoraTeachingCopilot: true,
  aiQuestionGenerator: true,
  aiQuizGenerator: true,
  aiHomeworkGenerator: true,
  aiMidtermGenerator: true,
  aiFinalExamGenerator: true,
  aiLectureSlideGenerator: true,
  aiFlashcardGenerator: true,
  aiRubricGenerator: true,
  aiAnnouncementGenerator: true,
  aiCourseNotesGenerator: true,
  aiPracticeProblemGenerator: true,
  aiGradingAssistance: true,
  aiFeedbackGenerator: true,
  studentRiskDetection: true,
  courseAnalytics: true,
  interactiveQuestionBuilder: true,
  aiAssessmentReview: true,
  officeHourAssistant: true,
  recommendationLetterAssistant: true,
  exportFormats: true,
  priorityAiModels: true,
  prioritySupport: true,
}

const TEAMS_FEATURES: InstructorMembershipFeatures = {
  ...PRO_FEATURES,
  coraCreditsPerPeriod: 15000,
  coraAiRequestsPerSemester: 15000,
  multipleInstructors: true,
  sharedQuestionBanks: true,
  sharedCoraKnowledgeBase: true,
  departmentAiResources: true,
  departmentAnalytics: true,
  crossCourseAnalytics: false,
  sharedAssessmentLibraries: true,
  teachingAssistantManagement: true,
  departmentTemplates: true,
  accreditationReportGeneration: false,
  institutionalAssessmentReports: false,
  collaborativeCourseAuthoring: true,
  advancedPermissionsWorkflows: true,
  dedicatedOnboarding: true,
}

export const INSTRUCTOR_MEMBERSHIP_PLANS: InstructorMembershipPlan[] = [
  {
    id: "Free",
    name: "Instructor Free",
    displayName: "Instructor Free",
    tagline: "Explore CourseCollab or teach a single small course.",
    semesterPriceInCents: 0,
    annualPriceInCents: 0,
    description: "Perfect for instructors exploring CourseCollab or teaching a single small course.",
    features: FREE_FEATURES,
    featureBullets: [
      "Up to 1 course",
      "Up to 50 students",
      "Basic assessment management",
      "Question Bank",
      "Manual content creation",
      "Basic grading tools",
      "Limited Cora Teaching Copilot (500 Cora Credits / semester)",
      "Community support",
    ],
    badge: "🆓",
    color: "gray",
  },
  {
    id: "Pro",
    name: "Instructor Pro",
    displayName: "Instructor Pro",
    tagline: "Cora Teaching Copilot + Complete Course Authoring Suite",
    semesterPriceInCents: 9900,
    annualPriceInCents: 24900,
    description:
      "Designed for instructors who want to save time creating, managing, and improving their courses.",
    features: PRO_FEATURES,
    featureBullets: [
      "Unlimited courses & students",
      "Full Cora Teaching Copilot (15,000 Cora Credits / semester)",
      "AI Question, Quiz, Homework, Midterm & Final Exam Generators",
      "AI Lecture & Slide, Flashcard, Rubric, Announcement & Course Notes Generators",
      "AI Practice Problem, Grading Assistance & Feedback Generators",
      "Student Risk Detection & Course Analytics",
      "Interactive Question Builder & AI Assessment Review",
      "Office Hour & Recommendation Letter Assistants",
      "Export to PDF, Word, and PowerPoint",
      "Priority AI models & priority support",
      "Cora Lite after allowance + credit packs available",
    ],
    badge: "⭐",
    color: "blue",
    recommended: true,
  },
  {
    id: "Teams",
    name: "Instructor Teams",
    displayName: "Instructor Teams",
    tagline: "Collaborative teaching for coordinated multi-section courses.",
    semesterPriceInCents: 19900,
    annualPriceInCents: 49900,
    description:
      "Designed for instructional teams teaching coordinated multi-section courses.",
    features: TEAMS_FEATURES,
    featureBullets: [
      "Everything in Instructor Pro",
      "15,000 Cora Credits / semester (45,000 annual)",
      "Multiple collaborating instructors",
      "Shared Question Banks & Cora resources",
      "Shared assessment libraries",
      "Collaborative course authoring",
      "Teaching Assistant management",
      "Advanced permissions & approval workflows",
      "Coordinated multi-section teaching",
      "Department/team templates & team analytics",
    ],
    badge: "🏛",
    color: "purple",
  },
]

/** Annual discount vs paying semester-by-semester (Fall + Spring + Summer ≈ 3 semesters). */
export function instructorAnnualSavingsCents(plan: InstructorMembershipPlan): number {
  const threeSemesters = plan.semesterPriceInCents * 3
  if (threeSemesters <= plan.annualPriceInCents) return 0
  return threeSemesters - plan.annualPriceInCents
}

export function getInstructorMembershipPlan(tier: InstructorMembershipTier): InstructorMembershipPlan {
  return INSTRUCTOR_MEMBERSHIP_PLANS.find((p) => p.id === tier) ?? INSTRUCTOR_MEMBERSHIP_PLANS[0]!
}
