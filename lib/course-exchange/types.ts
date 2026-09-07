/** Course Exchange module categories — must match repository teaching modules. */

export const COURSE_EXCHANGE_MODULES = [
  "syllabus",
  "lectures",
  "course_notes",
  "question_bank",
  "practice_hub",
  "flashcards",
  "quizzes",
  "homework",
  "classroom_points",
  "playground",
  "mid_semester_exams",
  "final_exams",
  "projects",
  "groups",
] as const

export type CourseExchangeModule = (typeof COURSE_EXCHANGE_MODULES)[number]

export type CourseExchangeSharingMode = "off" | "request_only"

export type CourseExchangeRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "COPYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export type CourseExchangeAttribution = {
  sourceInstructorName: string
  sourceCourseCode: string
  sourceCourseTitle: string
  sourceTermLabel?: string | null
  destinationInstructorName?: string | null
  copiedAt: string
  requestId: number
}

export type CourseExchangeRequestRow = {
  id: number
  source_course_id: number
  source_instructor_id: number
  requester_instructor_id: number
  status: CourseExchangeRequestStatus
  purpose: string | null
  requester_institution: string | null
  requester_department: string | null
  requested_modules: CourseExchangeModule[]
  approved_modules: CourseExchangeModule[] | null
  destination_course_id: number | null
  destination_session_id: number | null
  clone_summary: Record<string, unknown> | null
  clone_error: string | null
  created_at: string
  reviewed_at: string | null
  reviewed_by: number | null
  completed_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  cancelled_at: string | null
}

export type CloneCourseContentInput = {
  sourceCourseId: number
  destinationCourseId: number
  destinationInstructorId: number
  destinationSessionCode?: string | null
  destinationSessionId?: number | null
  selectedModules: CourseExchangeModule[]
  /** Maps built during clone — exposed for tests */
  maps?: CloneIdMaps
  /** When set, skip cloning rows whose source id is already mapped (prevents duplicate stacks). */
  reuseMaps?: CloneIdMaps | null
}

export type CloneIdMaps = {
  questionBank: Map<number, number>
  quizzes: Map<number, number>
  lectures: Map<number, number>
  flashcardDecks: Map<number, number>
  groups: Map<number, number>
  playgroundSessions: Map<number, number>
  courseNotes: Map<number, number>
}

export type CloneCourseContentResult = {
  maps: CloneIdMaps
  summary: Record<string, number>
  /** Tables that must never appear in a clone — verified empty post-clone */
  studentDataChecks: Record<string, number>
}

export type DiscoverCourseRelationshipKind =
  | "none"
  | "pending"
  | "approved"
  | "copying"
  | "imported"
  | "failed"
  | "rejected"
  | "cancelled"

export type DiscoverCourseRelationship = {
  kind: DiscoverCourseRelationshipKind
  requestId: number
  copyId: number | null
  status: CourseExchangeRequestStatus
  approvedModules: CourseExchangeModule[]
  missingModules: CourseExchangeModule[]
}

export type DiscoverableCourse = {
  courseId: number
  courseCode: string
  courseTitle: string
  discoverableTitle: string | null
  discoverableDescription: string | null
  description: string | null
  semester: string | null
  university: string | null
  instructorName: string
  instructorInstitution: string | null
  instructorDepartment: string | null
  /** True when the viewer owns this course (listed for transparency; not requestable). */
  isOwner: boolean
  /** Modules the owner opted to make requestable (never includes student results). */
  shareableModules: CourseExchangeModule[]
  autoApprove: boolean
  /** Latest exchange request/copy relationship for the viewing instructor. */
  relationship?: DiscoverCourseRelationship | null
}

export type ExchangeTimelineEntry = {
  id: string
  at: string
  actor: "requester" | "creator" | "system"
  actorName: string | null
  eventType: string
  label: string
  modules: CourseExchangeModule[]
  note: string | null
}
