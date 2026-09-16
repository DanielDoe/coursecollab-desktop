/**
 * Student Cora module capability registry.
 *
 * Source of truth for what Student Cora may do per CourseCollab module.
 * Cora does not invent privileges — it acts on behalf of the authenticated
 * student, within the same ownership / visibility rules as the student UI.
 *
 * Ownership classes:
 * - student_owned  → CRUD when the module allows the student to CRUD
 * - course_visible → READ; mutate only when the module grants students that op
 * - faculty_hidden → unavailable
 * - admin          → unavailable
 * - assessment     → dynamic via Assessment Integrity Context
 * - other_student  → unavailable
 */

export type StudentResourceClass =
  | "student_owned"
  | "course_visible"
  | "faculty_hidden"
  | "admin"
  | "assessment"
  | "other_student"

export type StudentCoraOperation =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "navigate"
  | "summarize"
  | "explain"
  | "generate"
  | "start"
  | "submit"
  | "send"
  | "book"
  | "cancel"
  | "join"
  | "leave"

export type StudentCoraModuleId =
  | "dashboard"
  | "lectures"
  | "notes"
  | "flashcards"
  | "ai-notetaker"
  | "practice"
  | "ai-tutor"
  | "codebench"
  | "codebench-more"
  | "quizzes"
  | "homework"
  | "mid-semester-exams"
  | "final-exams"
  | "grades"
  | "quiz-history"
  | "forum"
  | "messages"
  | "groups"
  | "projects"
  | "playground"
  | "classroom-points"
  | "attendance"
  | "trade-center"
  | "announcements"
  | "progress-review"
  | "syllabus"
  | "calendar"
  | "office-hours"
  | "course-policies"
  | "course-evaluation"
  | "recommendations"
  | "membership"
  | "help-center"
  | "submit-ticket"
  | "report-bug"
  | "feature-requests"
  | "settings"

export type StudentCoraModuleCapability = {
  module: StudentCoraModuleId
  version: number
  label: string
  resourceClass: StudentResourceClass
  /** Operations Cora may orchestrate when module + object-level auth allow. */
  allowed: readonly StudentCoraOperation[]
  /** Explicit denials — never grant even if the model asks. */
  denied: readonly string[]
  /** Mutations that require confirmation cards. */
  confirmationRequired: readonly StudentCoraOperation[]
  /** Nav / deep-link route hint for results. */
  route?: string
  /** Optional membership gate (mirrors student-nav). */
  minTier?: "Explorer" | "Trailblazer"
  /** Tools / intents to load when this module is relevant (contextual discovery). */
  toolHints: readonly string[]
}

export const STUDENT_CORA_MODULE_REGISTRY: Record<StudentCoraModuleId, StudentCoraModuleCapability> =
  {
    dashboard: {
      module: "dashboard",
      version: 1,
      label: "Dashboard",
      resourceClass: "course_visible",
      allowed: ["read", "summarize", "explain", "navigate"],
      denied: ["change_grades", "change_instructor_metrics"],
      confirmationRequired: [],
      route: "/dashboard",
      toolHints: ["get_student_summary", "get_assessments", "get_calendar_events"],
    },
    lectures: {
      module: "lectures",
      version: 1,
      label: "Lectures",
      resourceClass: "course_visible",
      allowed: ["read", "summarize", "explain", "generate", "navigate", "start"],
      denied: ["access_locked_unpublished_lectures"],
      confirmationRequired: [],
      route: "/module/lectures",
      toolHints: ["get_lecture_progress", "search_lecture_materials", "propose_personal_note", "propose_personal_flashcards"],
    },
    notes: {
      module: "notes",
      version: 1,
      label: "My Notes",
      resourceClass: "student_owned",
      allowed: ["read", "create", "update", "delete", "summarize", "generate", "navigate"],
      denied: ["edit_instructor_course_notes"],
      confirmationRequired: ["create", "update", "delete"],
      route: "/module/notes",
      toolHints: ["propose_personal_note", "get_flashcards_and_notes"],
    },
    flashcards: {
      module: "flashcards",
      version: 1,
      label: "Flashcards",
      resourceClass: "student_owned",
      allowed: ["read", "create", "update", "delete", "generate", "start", "navigate"],
      denied: ["modify_instructor_owned_decks"],
      confirmationRequired: ["create", "update", "delete"],
      route: "/module/flashcards",
      toolHints: ["propose_personal_flashcards", "get_flashcards_and_notes"],
    },
    "ai-notetaker": {
      module: "ai-notetaker",
      version: 1,
      label: "AI Notetaker",
      resourceClass: "student_owned",
      allowed: ["read", "summarize", "generate", "start", "navigate"],
      denied: ["access_other_student_recordings"],
      confirmationRequired: ["create"],
      route: "/module/ai-notetaker",
      minTier: "Explorer",
      toolHints: ["propose_personal_note", "propose_personal_flashcards", "propose_study_plan"],
    },
    practice: {
      module: "practice",
      version: 1,
      label: "Practice Hub",
      resourceClass: "course_visible",
      allowed: ["read", "start", "generate", "explain", "navigate"],
      denied: ["reveal_protected_question_bank", "reveal_exam_content"],
      confirmationRequired: ["start"],
      route: "/module/practice",
      toolHints: ["propose_practice_quiz", "search_platform"],
    },
    "ai-tutor": {
      module: "ai-tutor",
      version: 1,
      label: "Cora",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "generate", "navigate"],
      denied: ["escalate_permissions"],
      confirmationRequired: [],
      route: "/module/ai-tutor",
      minTier: "Explorer",
      toolHints: ["chat"],
    },
    codebench: {
      module: "codebench",
      version: 1,
      label: "CodeBench IDE",
      resourceClass: "student_owned",
      allowed: ["read", "create", "update", "explain", "generate", "start", "navigate"],
      denied: ["access_instructor_solutions", "access_private_instructor_code"],
      confirmationRequired: ["create", "delete"],
      route: "/module/codebench",
      minTier: "Scholar",
      toolHints: ["code_assistant"],
    },
    "codebench-more": {
      module: "codebench-more",
      version: 1,
      label: "Analytics & More",
      resourceClass: "student_owned",
      allowed: ["read", "summarize", "explain", "navigate"],
      denied: ["access_other_student_analytics"],
      confirmationRequired: [],
      route: "/module/codebench-more",
      minTier: "Scholar",
      toolHints: ["get_student_summary"],
    },
    quizzes: {
      module: "quizzes",
      version: 1,
      label: "Quizzes",
      resourceClass: "assessment",
      allowed: ["read", "explain", "navigate", "start"],
      denied: ["answer_active_protected_assessment", "reveal_answer_keys"],
      confirmationRequired: ["start"],
      route: "/module/quizzes",
      toolHints: ["get_assessments", "get_assessment_integrity", "review_released_attempt"],
    },
    homework: {
      module: "homework",
      version: 1,
      label: "Homework",
      resourceClass: "assessment",
      allowed: ["read", "explain", "navigate", "start"],
      denied: ["answer_active_protected_assessment", "reveal_answer_keys"],
      confirmationRequired: ["start"],
      route: "/module/homework",
      toolHints: ["get_assessments", "get_assessment_integrity", "review_released_attempt"],
    },
    "mid-semester-exams": {
      module: "mid-semester-exams",
      version: 1,
      label: "Mid-Semester",
      resourceClass: "assessment",
      allowed: ["read", "explain", "navigate"],
      denied: ["solve_during_protected_exam", "retrieve_answers_during_exam", "start"],
      confirmationRequired: [],
      route: "/module/mid-semester-exams",
      toolHints: ["get_assessments", "get_assessment_integrity"],
    },
    "final-exams": {
      module: "final-exams",
      version: 1,
      label: "Finals",
      resourceClass: "assessment",
      allowed: ["read", "explain", "navigate"],
      denied: ["solve_during_protected_exam", "retrieve_answers_during_exam"],
      confirmationRequired: [],
      route: "/module/final-exams",
      toolHints: ["get_assessments", "get_assessment_integrity"],
    },
    grades: {
      module: "grades",
      version: 1,
      label: "Grades",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "summarize", "navigate"],
      denied: ["modify_grades", "read_other_student_grades"],
      confirmationRequired: [],
      route: "/module/grades",
      toolHints: ["get_student_summary", "get_assessments"],
    },
    "quiz-history": {
      module: "quiz-history",
      version: 1,
      label: "History",
      resourceClass: "assessment",
      allowed: ["read", "explain", "summarize", "generate", "navigate"],
      denied: ["retrieve_unreleased_solutions"],
      confirmationRequired: [],
      route: "/module/quiz-history",
      toolHints: [
        "get_assessments",
        "get_assessment_integrity",
        "review_released_attempt",
        "propose_personal_flashcards",
        "propose_practice_quiz",
      ],
    },
    forum: {
      module: "forum",
      version: 1,
      label: "Forum Hub",
      resourceClass: "course_visible",
      allowed: ["read", "create", "summarize", "navigate"],
      denied: ["moderate_others", "delete_others_content"],
      confirmationRequired: ["create", "send"],
      route: "/module/forum",
      toolHints: ["search_platform"],
    },
    messages: {
      module: "messages",
      version: 1,
      label: "Messages",
      resourceClass: "student_owned",
      allowed: ["read", "create", "send", "summarize", "navigate"],
      denied: ["read_unrelated_private_conversations"],
      confirmationRequired: ["send"],
      route: "/module/messages",
      toolHints: [],
    },
    groups: {
      module: "groups",
      version: 1,
      label: "Groups",
      resourceClass: "course_visible",
      allowed: ["read", "create", "join", "leave", "summarize", "navigate"],
      denied: ["manage_beyond_student_permissions"],
      confirmationRequired: ["create", "join", "leave"],
      route: "/module/groups",
      toolHints: [],
    },
    projects: {
      module: "projects",
      version: 1,
      label: "Projects",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "summarize", "update", "submit", "navigate"],
      denied: ["view_other_teams_private_submissions"],
      confirmationRequired: ["submit", "update"],
      route: "/module/projects",
      toolHints: ["get_calendar_events"],
    },
    playground: {
      module: "playground",
      version: 1,
      label: "Playground",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "join", "start", "navigate"],
      denied: ["manipulate_scores", "change_session_configuration"],
      confirmationRequired: ["join", "start"],
      route: "/module/playground",
      toolHints: [],
    },
    "classroom-points": {
      module: "classroom-points",
      version: 1,
      label: "Classroom Points",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "summarize", "submit", "navigate"],
      denied: ["approve_points"],
      confirmationRequired: ["submit"],
      route: "/module/classroom-points",
      toolHints: ["get_classroom_points"],
    },
    attendance: {
      module: "attendance",
      version: 1,
      label: "Attendance",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "summarize", "start", "navigate"],
      denied: ["fabricate_attendance", "check_in_outside_validation"],
      confirmationRequired: ["start"],
      route: "/module/attendance",
      toolHints: ["get_attendance"],
    },
    "trade-center": {
      module: "trade-center",
      version: 1,
      label: "Trade Center",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "create", "submit", "navigate"],
      denied: ["change_conversion_rules", "change_balances_directly"],
      confirmationRequired: ["create", "submit"],
      route: "/module/trade-center",
      toolHints: [],
    },
    announcements: {
      module: "announcements",
      version: 1,
      label: "Announcements",
      resourceClass: "course_visible",
      allowed: ["read", "summarize", "explain", "navigate"],
      denied: ["create_instructor_announcements"],
      confirmationRequired: [],
      route: "/announcements",
      toolHints: ["get_notifications", "search_platform"],
    },
    "progress-review": {
      module: "progress-review",
      version: 1,
      label: "Progress Review",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "summarize", "generate", "navigate"],
      denied: ["read_unpublished_instructor_only_reviews"],
      confirmationRequired: [],
      route: "/module/progress-review",
      toolHints: ["get_student_summary", "propose_study_plan"],
    },
    syllabus: {
      module: "syllabus",
      version: 1,
      label: "Syllabus",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "summarize", "navigate"],
      denied: ["modify_syllabus"],
      confirmationRequired: [],
      route: "/module/syllabus",
      toolHints: ["search_platform"],
    },
    calendar: {
      module: "calendar",
      version: 1,
      label: "Calendar",
      resourceClass: "student_owned",
      allowed: ["read", "create", "update", "delete", "navigate"],
      denied: ["modify_official_course_events"],
      confirmationRequired: ["create", "update", "delete"],
      route: "/module/calendar",
      toolHints: ["get_calendar_events", "propose_calendar_study_sessions", "propose_study_plan"],
    },
    "office-hours": {
      module: "office-hours",
      version: 1,
      label: "Office Hours",
      resourceClass: "course_visible",
      allowed: ["read", "book", "cancel", "explain", "navigate"],
      denied: ["approve_own_request", "change_instructor_availability"],
      confirmationRequired: ["book", "cancel"],
      route: "/module/office-hours",
      toolHints: ["get_calendar_events"],
    },
    "course-policies": {
      module: "course-policies",
      version: 1,
      label: "Policies",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "summarize", "navigate"],
      denied: ["modify_policies"],
      confirmationRequired: [],
      route: "/module/course-policies",
      toolHints: ["search_platform"],
    },
    "course-evaluation": {
      module: "course-evaluation",
      version: 1,
      label: "Course Evaluation",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "navigate", "start"],
      denied: ["fabricate_completion"],
      confirmationRequired: ["submit"],
      route: "/module/course-evaluation",
      toolHints: [],
    },
    recommendations: {
      module: "recommendations",
      version: 1,
      label: "Recommendation Letters",
      resourceClass: "student_owned",
      allowed: ["read", "create", "submit", "cancel", "navigate"],
      denied: ["read_confidential_faculty_letter"],
      confirmationRequired: ["create", "submit", "cancel"],
      route: "/module/recommendations",
      toolHints: [],
    },
    membership: {
      module: "membership",
      version: 1,
      label: "Membership",
      resourceClass: "student_owned",
      allowed: ["read", "explain", "navigate"],
      denied: ["change_subscription_without_billing_flow"],
      confirmationRequired: [],
      route: "/membership",
      toolHints: ["get_student_summary"],
    },
    "help-center": {
      module: "help-center",
      version: 1,
      label: "Help Center",
      resourceClass: "course_visible",
      allowed: ["read", "explain", "navigate"],
      denied: ["access_other_users_support_records"],
      confirmationRequired: [],
      route: "/module/help-center",
      toolHints: [],
    },
    "submit-ticket": {
      module: "submit-ticket",
      version: 1,
      label: "Submit Ticket",
      resourceClass: "student_owned",
      allowed: ["read", "create", "navigate"],
      denied: ["access_other_users_support_records"],
      confirmationRequired: ["create"],
      route: "/module/submit-ticket",
      toolHints: [],
    },
    "report-bug": {
      module: "report-bug",
      version: 1,
      label: "Report Bug",
      resourceClass: "student_owned",
      allowed: ["read", "create", "navigate"],
      denied: ["access_other_users_support_records"],
      confirmationRequired: ["create"],
      route: "/module/report-bug",
      toolHints: [],
    },
    "feature-requests": {
      module: "feature-requests",
      version: 1,
      label: "Feature Requests",
      resourceClass: "student_owned",
      allowed: ["read", "create", "navigate"],
      denied: ["access_other_users_support_records"],
      confirmationRequired: ["create"],
      route: "/module/feature-requests",
      toolHints: [],
    },
    settings: {
      module: "settings",
      version: 1,
      label: "Settings",
      resourceClass: "student_owned",
      allowed: ["read", "update", "navigate"],
      denied: ["change_role", "change_institution", "change_permissions", "change_ownership"],
      confirmationRequired: ["update"],
      route: "/settings",
      toolHints: [],
    },
  }

export const STUDENT_CORA_AUTHORIZATION_PRINCIPLE = `
STUDENT-OWNED RESOURCE
    → Cora may CRUD when the underlying CourseCollab module allows the
      student to CRUD that resource.

COURSE RESOURCE VISIBLE TO STUDENT
    → Cora may READ it but may only mutate it when the underlying module
      explicitly grants students that operation.

FACULTY-OWNED / HIDDEN RESOURCE
    → unavailable.

ADMIN / INSTITUTION RESOURCE
    → unavailable.

ASSESSMENT RESOURCE
    → capabilities are dynamically determined by assessment state,
      release state, assessment Cora policy, and instructor settings.

OTHER STUDENT'S PRIVATE RESOURCE
    → unavailable.
`.trim()

export function getStudentModuleCapability(
  moduleId: string,
): StudentCoraModuleCapability | null {
  return STUDENT_CORA_MODULE_REGISTRY[moduleId as StudentCoraModuleId] ?? null
}

export function studentModuleAllows(
  moduleId: StudentCoraModuleId,
  operation: StudentCoraOperation,
): boolean {
  const cap = STUDENT_CORA_MODULE_REGISTRY[moduleId]
  return cap?.allowed.includes(operation) ?? false
}

export function studentModulesForIntent(keywords: string[]): StudentCoraModuleCapability[] {
  const text = keywords.join(" ").toLowerCase()
  return Object.values(STUDENT_CORA_MODULE_REGISTRY).filter((cap) => {
    if (text.includes(cap.module.replace(/-/g, " ")) || text.includes(cap.label.toLowerCase())) {
      return true
    }
    return cap.toolHints.some((hint) => text.includes(hint.replace(/_/g, " ")))
  })
}

/** Compact context packet for prompts — not the full registry dump. */
export function buildStudentCapabilityPacket(moduleIds: StudentCoraModuleId[]): string {
  const lines = moduleIds.map((id) => {
    const cap = STUDENT_CORA_MODULE_REGISTRY[id]
    if (!cap) return null
    const route = cap.route ? ` → open ${cap.route}` : ""
    return `- ${cap.label} (${cap.resourceClass})${route}: allow [${cap.allowed.join(", ")}]; deny [${cap.denied.join(", ")}]`
  })
  return [
    "Student Cora capability packet (authenticated student scope only):",
    "Native app routes only — never web /student/dashboard-v2/* paths.",
    STUDENT_CORA_AUTHORIZATION_PRINCIPLE,
    "",
    ...lines.filter(Boolean),
    "",
    "Executable tools: prefer dedicated propose_* when listed; otherwise propose_student_capability with registry capability_id (e.g. flashcards.create, forum.create, office-hours.book).",
  ].join("\n")
}

/** All native routes Cora may open after student tool confirmations. */
export function listStudentNativeModuleRoutes(): ReadonlyArray<{ module: StudentCoraModuleId; route: string }> {
  return Object.values(STUDENT_CORA_MODULE_REGISTRY)
    .filter((cap): cap is StudentCoraModuleCapability & { route: string } => Boolean(cap.route))
    .map((cap) => ({ module: cap.module, route: cap.route }))
}
