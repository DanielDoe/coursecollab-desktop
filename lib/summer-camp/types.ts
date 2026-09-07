export type CampStatus = "draft" | "published" | "active" | "completed" | "archived"
export type TrainingStatus = "draft" | "published" | "unpublished"
export type ModuleStatus = "draft" | "published" | "unpublished"
export type EnrollmentStatus = "active" | "completed" | "withdrawn"
export type SubmissionStatus = "submitted" | "reviewed" | "approved" | "revision_needed"
export type DiscussionStatus = "open" | "answered" | "resolved"
export type StudentProgramRole = "regular" | "summer_camper" | "summer_student" | "platform_guest"

export type CampBlockType =
  | "text"
  | "image"
  | "code"
  | "image_gallery"
  | "pdf"
  | "video"
  | "step"
  | "checkpoint"
  | "quiz"
  | "callout"
  | "reflection"
  | "activity"
  | "feedback"
  | "interactive"
  | "confidence"
  | "hero"
  | "faculty_cards"
  | "mission_objectives"
  | "profile_form"
  | "module_completion"
  | "column_grid"

export interface SummerCamp {
  id: number
  slug: string
  title: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: CampStatus
  course_id: number | null
  created_at: string
  updated_at: string
}

export interface CampTraining {
  id: number
  camp_id: number
  slug: string
  title: string
  description: string | null
  sort_order: number
  status: TrainingStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CampProject {
  id: number
  training_id: number
  title: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CampModule {
  id: number
  project_id: number
  title: string
  description: string | null
  sort_order: number
  status: ModuleStatus
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CampModuleBlock {
  id: number
  module_id: number
  block_type: CampBlockType
  content: Record<string, unknown>
  sort_order: number
  created_at: string
  updated_at: string
}

export interface CampEnrollment {
  id: number
  student_id: number
  training_id: number
  camp_id: number
  enrolled_at: string
  status: EnrollmentStatus
}

export interface CampProgress {
  id: number
  enrollment_id: number
  student_id: number
  module_id: number
  block_id: number | null
  progress_type: "module_complete" | "step_complete"
  completed_at: string
  metadata: Record<string, unknown>
}

export interface CampSubmission {
  id: number
  enrollment_id: number
  student_id: number
  block_id: number
  module_id: number
  file_url: string | null
  file_name: string | null
  content: Record<string, unknown> | null
  status: SubmissionStatus
  grade: string | null
  feedback: string | null
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: number | null
}

export interface CampDiscussion {
  id: number
  module_id: number
  block_id: number | null
  student_id: number
  instructor_id: number | null
  parent_id: number | null
  status: DiscussionStatus
  title: string | null
  body: string
  attachments: unknown[]
  mentions: unknown[]
  created_at: string
  updated_at: string
}

export const CAMP_BLOCK_TYPES: CampBlockType[] = [
  "text",
  "image",
  "code",
  "image_gallery",
  "pdf",
  "video",
  "step",
  "checkpoint",
  "quiz",
  "callout",
  "reflection",
  "activity",
  "feedback",
  "interactive",
  "confidence",
  "hero",
  "faculty_cards",
  "mission_objectives",
  "profile_form",
  "module_completion",
  "column_grid",
]

export interface CampCamperProfile {
  student_id: number
  profile: Record<string, unknown>
  total_xp: number
  badges: string[]
  updated_at: string
}
