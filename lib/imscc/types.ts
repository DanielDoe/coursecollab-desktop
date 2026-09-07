/** Normalized IMS Common Cartridge catalog (Canvas .imscc). */

export type ImsccKind =
  | "course"
  | "syllabus"
  | "module"
  | "page"
  | "lecture"
  | "file"
  | "weblink"
  | "announcement"
  | "discussion"
  | "assignment"
  | "quiz"
  | "question"
  | "assignment_group"
  | "unsupported"

export type CourseCollabTarget =
  | "course"
  | "syllabus"
  | "lectures"
  | "course_notes"
  | "course_files"
  | "resource_links"
  | "announcements"
  | "homework"
  | "quizzes"
  | "mid_semester"
  | "final"
  | "question_bank"
  | "grading_categories"
  | "attendance"
  | "classroom_points"
  | "none"

export type ImsccQuestionType =
  | "mcq"
  | "true_false"
  | "select_all"
  | "essay"
  | "short_answer"
  | "needs_review"

export type ImsccQuestion = {
  identifier: string
  title: string
  canvasType: string
  mappedType: ImsccQuestionType
  stem: string
  options: { id: string; text: string }[]
  correctAnswer: string | string[] | null
  points: number | null
  needsReview: boolean
  reviewReason: string | null
}

export type ImsccItem = {
  identifier: string
  kind: ImsccKind
  title: string
  href?: string | null
  html?: string | null
  url?: string | null
  mimeHint?: string | null
  bytes?: number | null
  published: boolean
  moduleId?: string | null
  moduleTitle?: string | null
  week?: number | null
  assignmentGroupId?: string | null
  assignmentGroupTitle?: string | null
  pointsPossible?: number | null
  submissionTypes?: string | null
  unlockAt?: string | null
  dueAt?: string | null
  mapping: {
    target: CourseCollabTarget
    label: string
    selectedDefault: boolean
    blocked?: boolean
    blockReason?: string | null
  }
  questions?: ImsccQuestion[]
}

export type ImsccModule = {
  identifier: string
  title: string
  position: number
  published: boolean
  itemIds: string[]
  week: number | null
}

export type ImsccAssignmentGroup = {
  identifier: string
  title: string
  position: number
  weight: number | null
}

export type ImsccCourseInfo = {
  title: string
  courseCode: string
  suggestedCode: string
  suggestedTitle: string
  termLabel: string | null
  exportDate: string | null
  schema: string
  schemaVersion: string
  fileCount: number
  packageBytes: number
}

export type ImsccFoundCategory = {
  id: string
  label: string
  count: number
}

export type ImsccCatalog = {
  info: ImsccCourseInfo
  modules: ImsccModule[]
  assignmentGroups: ImsccAssignmentGroup[]
  items: ImsccItem[]
  found: ImsccFoundCategory[]
  warnings: string[]
}

export type ImsccImportSelection = {
  itemIds: string[]
  courseCode: string
  courseTitle: string
  description?: string | null
}

export type ImsccCommitCounts = {
  syllabus: number
  notes: number
  lectures: number
  assessments: number
  quizzes: number
  homework: number
  questions: number
  questionsNeedingReview: number
  links: number
  files: number
  filesCataloged: number
  skipped: number
  total: number
}

export type ImsccReviewCheck = {
  ok: boolean
  label: string
}

export type ImsccReviewIssue = {
  id: string
  title: string
  detail: string
}

export type ImsccReview = {
  checks: ImsccReviewCheck[]
  issues: ImsccReviewIssue[]
}
