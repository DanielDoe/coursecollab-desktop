import type {
  ProjectAiGradingSettings,
  ProjectFeedbackReleaseSettings,
  ProjectIntegritySettings,
} from "@/lib/projects/project-integrity-types"

export const PROJECT_GRADING_MODES = [
  "INSTRUCTOR_ONLY",
  "PEER_ONLY",
  "PEER_PLUS_INSTRUCTOR",
  "AI_ONLY",
  "INSTRUCTOR_WITH_AI_ASSIST",
  "CUSTOM_WEIGHTED",
] as const

export type ProjectGradingMode = (typeof PROJECT_GRADING_MODES)[number]

export const PROJECT_COMPONENT_KEYS = [
  "peer",
  "instructor",
  "report",
  "presentation",
  "ai",
  "other",
] as const

export type ProjectComponentKey = (typeof PROJECT_COMPONENT_KEYS)[number]

export type ProjectGradingComponent = {
  key: ProjectComponentKey
  label: string
  weight_percent: number
  enabled: boolean
  /** Legacy peer cap mapping: points_possible within max_points */
  points_cap?: number | null
}

export type ProjectPeerVotingConfig = {
  enabled: boolean
  voters: "all_students" | "section_peers" | "instructor_assigned"
  anonymous: boolean
  allow_own_group_voting: boolean
  open_at: string | null
  close_at: string | null
  rating_method: "stars" | "simple_vote"
  require_written_feedback: boolean
  show_running_results: boolean
  show_leaderboard: boolean
}

export type ProjectPresentationConfig = {
  required: boolean
  window_start: string | null
  window_end: string | null
  duration_minutes: number | null
  location: string | null
  slides_required: boolean
  demonstration_required: boolean
  points_weight_percent: number
  rubric_section_id: string | null
  /** Suggest-only AI help while instructor grading; not a separate grade source. */
  instructor_ai_assist?: boolean
}

export type ProjectProposalMode = "student" | "instructor"

export type ProjectSubmissionConfig = {
  allow_resubmissions: boolean
  max_resubmissions: number | null
  require_instructor_approval: boolean
  template_url: string | null
  template_instructions: string | null
  /** student = groups propose their own project. instructor = shared title + report template. */
  proposal_mode: ProjectProposalMode
}

export type ProjectLatePolicy = {
  allow_late: boolean
  penalty_percent_per_day: number
  max_days_late: number | null
}

export type ProjectRubricLevel = {
  id: string
  label: string
  description?: string
  points?: number | null
}

export type ProjectRubricCriterion = {
  id: string
  title: string
  description?: string
  weight_percent: number
  max_points: number
  levels: ProjectRubricLevel[]
}

export type ProjectRubric = {
  type: "simple" | "analytic"
  criteria: ProjectRubricCriterion[]
  overall_comment_enabled: boolean
}

export type CourseProjectAssignmentRecord = {
  id: number
  course_id: number
  session: string | null
  title: string
  description: string | null
  instructions: string | null
  project_mode: "individual" | "group"
  status: "draft" | "published" | "archived"
  available_from: string | null
  available_until: string | null
  due_at: string | null
  late_policy: ProjectLatePolicy
  min_group_size: number | null
  max_group_size: number | null
  counts_toward_course_grade: boolean
  max_points: number
  required_deliverables: string[]
  resources: { title: string; url: string }[]
  resubmissions: ProjectSubmissionConfig
  grading_mode: ProjectGradingMode
  grading_components: ProjectGradingComponent[]
  rubric: ProjectRubric
  peer_voting: ProjectPeerVotingConfig
  submission: ProjectSubmissionConfig
  presentation: ProjectPresentationConfig
  integrity_settings: ProjectIntegritySettings
  ai_grading_settings: ProjectAiGradingSettings
  feedback_release: ProjectFeedbackReleaseSettings
}
