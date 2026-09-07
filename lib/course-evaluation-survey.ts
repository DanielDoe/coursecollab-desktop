/** Course evaluation survey definitions — shared by student form, API validation, instructor review. */

export const LIKERT_5 = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Fair" },
  { value: 3, label: "Good" },
  { value: 4, label: "Very Good" },
  { value: 5, label: "Excellent" },
] as const

export const PLATFORM_HELPFULNESS_LIKERT = [
  { value: 1, label: "Not at all" },
  { value: 2, label: "Slightly" },
  { value: 3, label: "Moderately" },
  { value: 4, label: "Significantly" },
  { value: 5, label: "Extremely" },
] as const

export const INSTRUCTOR_CLARITY_LIKERT = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Neutral" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
] as const

export const SURVEY_OTHER_OPTION = "Other" as const

export const FAVORITE_FEATURE_OPTIONS = [
  "AI Tutor",
  "Practice Hub",
  "CodeBench",
  "Playground",
  "Lecture Slides",
  "Homework",
  "Quizzes",
  "Attendance",
  "Classroom Points",
  "Trade Center",
  "Announcements",
  "Calendar",
  "Grades Dashboard",
  "Team Projects",
  "Other",
] as const

export const FEATURE_TO_IMPROVE_OPTIONS = [
  "User Interface",
  "Mobile Experience",
  "Performance / Speed",
  "AI Tutor",
  "CodeBench",
  "Practice Hub",
  "Notifications",
  "Analytics",
  "Classroom Points",
  "Trade Center",
  "Other",
] as const

export const WORKLOAD_OPTIONS = [
  "Too Light",
  "Slightly Light",
  "Just Right",
  "Slightly Heavy",
  "Too Heavy",
] as const

export const AI_TUTOR_USAGE_OPTIONS = [
  "Never",
  "Rarely",
  "Sometimes",
  "Often",
  "Daily",
] as const

export type FavoriteFeature = (typeof FAVORITE_FEATURE_OPTIONS)[number]
export type FeatureToImprove = (typeof FEATURE_TO_IMPROVE_OPTIONS)[number]
export type WorkloadOption = (typeof WORKLOAD_OPTIONS)[number]
export type AiTutorUsageOption = (typeof AI_TUTOR_USAGE_OPTIONS)[number]

export type CourseEvaluationSurveyResponses = {
  overallExperience: number
  platformHelpfulness: number
  favoriteFeatures: string[]
  featureToImprove: string
  openFeedback: string
  instructorClarity?: number | null
  workload?: string | null
  aiTutorUsage?: string | null
  npsScore?: number | null
  missingFeatures?: string | null
}

export function parseLikert1to5(raw: unknown, fieldName: string): number | null {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10)
  if (!Number.isFinite(n) || n < 1 || n > 5) return null
  return n
}

export function parseNps(raw: unknown): number | null {
  if (raw === "" || raw == null) return null
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  return n
}

export function parseFavoriteFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map(String).filter((v) => (FAVORITE_FEATURE_OPTIONS as readonly string[]).includes(v))
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((v) => (FAVORITE_FEATURE_OPTIONS as readonly string[]).includes(v))
      }
    } catch {
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter((v) => (FAVORITE_FEATURE_OPTIONS as readonly string[]).includes(v))
    }
  }
  return []
}

export function isValidFeatureToImprove(value: string): value is FeatureToImprove {
  return (FEATURE_TO_IMPROVE_OPTIONS as readonly string[]).includes(value)
}

export function isValidWorkload(value: string): value is WorkloadOption {
  return (WORKLOAD_OPTIONS as readonly string[]).includes(value)
}

export function isValidAiTutorUsage(value: string): value is AiTutorUsageOption {
  return (AI_TUTOR_USAGE_OPTIONS as readonly string[]).includes(value)
}

export function likertLabel(
  options: readonly { value: number; label: string }[],
  value?: number | null,
): string {
  if (value == null) return "—"
  return options.find((o) => o.value === value)?.label ?? String(value)
}
