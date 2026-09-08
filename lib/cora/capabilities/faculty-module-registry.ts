/**
 * Faculty Cora module capability registry.
 *
 * Faculty Cora is an authenticated teaching agent that operates CourseCollab
 * on behalf of the instructor — NOT a standalone AI content generator.
 *
 * Do not duplicate business logic into Cora*Tool classes.
 * Cora discovers capabilities here and invokes shared CourseCollab services:
 *
 *   Web UI / Mobile UI / Cora Tool  →  Module Service  →  DB
 *
 * Membership tiers (Free / Pro / Teams) gate capabilities alongside
 * role, institution, course assignment, and resource ownership.
 */

export type FacultyMembershipTier = "Free" | "Pro" | "Teams"

export type FacultyRiskLevel = "none" | "confirm" | "high" | "forbidden"

/**
 * Prefer unified R0–R4 from `@/lib/cora/capabilities/risk-levels`.
 * Legacy FacultyRiskLevel remains for confirm UI / transaction plans.
 */
export type CoraRiskLevel = FacultyRiskLevel

export type FacultyCoraOperation =
  | "list"
  | "read"
  | "search"
  | "analyze"
  | "summarize"
  | "navigate"
  | "create"
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "publish"
  | "unpublish"
  | "schedule"
  | "send"
  | "validate"
  | "preview"
  | "bulkCreate"
  | "configure"
  | "approve"
  | "award"
  | "regrade"
  | "export"

export type FacultyCoraModuleId =
  | "dashboard"
  | "academic-terms"
  | "announcements"
  | "syllabus"
  | "lectures"
  | "course-notes"
  | "flashcards"
  | "practice"
  | "playground"
  | "groups"
  | "projects"
  | "course-exchange"
  | "summer-camp"
  | "campers"
  | "question-bank"
  | "quizzes"
  | "homework"
  | "mid-semester-exams"
  | "final-exams"
  | "classroom-points"
  | "course-evaluations"
  | "attendance"
  | "students"
  | "office-hours"
  | "recommendations"
  | "trade-center"
  | "results"
  | "student-progress"
  | "reports"
  | "progress-reviews"
  | "recent-activity"
  | "notifications"
  | "messages"
  | "discussions"
  | "student-support"
  | "course-settings"
  | "assessment-governance"
  | "assessment-defaults"
  | "grading-policies"
  | "attendance-policies"
  | "classroom-points-rules"
  | "playground-rules"
  | "ai-assistant-settings"
  | "team-project-policies"
  | "submission-issues"
  | "teaching-assistants"
  | "membership"
  | "help-center"
  | "submit-ticket"
  | "report-bug"
  | "feature-requests"

export type FacultyCoraModuleCapability = {
  module: FacultyCoraModuleId
  version: number
  label: string
  /** Stable capability IDs Cora reasons over (not raw SQL). */
  capabilities: readonly string[]
  /** Default risk per consequential op family. */
  risk: Partial<Record<FacultyCoraOperation, FacultyRiskLevel>>
  /** CourseCollab service / API surface Cora must reuse (no parallel DB path). */
  serviceHint: string
  route?: string
  minTier?: FacultyMembershipTier
  /** Explicit agent tool names for this module (optional — see faculty-tool-registry.ts). */
  toolHints?: readonly string[]
  /** Explicit denials even if the model asks. */
  denied: readonly string[]
  notes?: string
}

const READ = { list: "none", read: "none", search: "none", analyze: "none", summarize: "none", navigate: "none", preview: "none" } as const
const CONTENT_WRITE = { create: "confirm", update: "confirm", delete: "high", archive: "confirm", restore: "confirm", publish: "high", unpublish: "high" } as const
const COMM_WRITE = { create: "confirm", update: "confirm", send: "high", publish: "high", delete: "high" } as const
const ASSESS_WRITE = {
  create: "confirm",
  update: "confirm",
  configure: "confirm",
  publish: "high",
  unpublish: "high",
  delete: "high",
  preview: "none",
} as const

export const FACULTY_CORA_MODULE_REGISTRY: Record<FacultyCoraModuleId, FacultyCoraModuleCapability> = {
  dashboard: {
    module: "dashboard",
    version: 1,
    label: "Dashboard",
    capabilities: ["dashboard.read", "dashboard.analyze", "dashboard.navigate"],
    risk: { ...READ },
    serviceHint: "fetchFacultyContext / instructor dashboard APIs",
    route: "/module/dashboard",
    denied: ["admin_platform_config"],
  },
  "academic-terms": {
    module: "academic-terms",
    version: 1,
    label: "Academic Terms",
    capabilities: ["terms.read", "terms.diagnose", "terms.update"],
    risk: { ...READ, update: "confirm", configure: "confirm" },
    serviceHint: "instructor academic-terms service",
    route: "/module/academic-terms",
    denied: ["institution_term_override"],
  },
  announcements: {
    module: "announcements",
    version: 1,
    label: "Announcements",
    capabilities: [
      "announcement.list",
      "announcement.read",
      "announcement.create",
      "announcement.update",
      "announcement.delete",
      "announcement.publish",
      "announcement.schedule",
      "announcement.archive",
    ],
    risk: { ...READ, ...COMM_WRITE, schedule: "confirm", archive: "confirm" },
    serviceHint: "listCourseAnnouncements / createCourseAnnouncement / POST /api/announcements",
    route: "/module/announcements",
    denied: ["global_institution_announcement"],
    notes: "List is read-only via list_course_announcements. Create often equals publish; always preview + confirm before send.",
  },
  syllabus: {
    module: "syllabus",
    version: 1,
    label: "Syllabus",
    capabilities: ["syllabus.read", "syllabus.draft", "syllabus.update", "syllabus.publish"],
    risk: { ...READ, create: "confirm", update: "confirm", publish: "high" },
    serviceHint: "instructor syllabus service",
    route: "/module/syllabus",
    denied: [],
  },
  lectures: {
    module: "lectures",
    version: 1,
    label: "Lectures",
    capabilities: [
      "lecture.list",
      "lecture.read",
      "lecture.create",
      "lecture.update",
      "lecture.attach",
      "lecture.publish",
    ],
    risk: { ...READ, ...CONTENT_WRITE },
    serviceHint: "instructor lectures service",
    route: "/module/lectures",
    denied: [],
  },
  "course-notes": {
    module: "course-notes",
    version: 1,
    label: "Course Notes",
    capabilities: [
      "courseNote.list",
      "courseNote.read",
      "courseNote.create",
      "courseNote.update",
      "courseNote.publish",
      "courseNote.softDelete",
      "courseNote.restore",
    ],
    risk: { ...READ, ...CONTENT_WRITE },
    serviceHint: "instructor course-notes API",
    route: "/module/course-notes",
    denied: ["edit_student_personal_notes"],
  },
  flashcards: {
    module: "flashcards",
    version: 1,
    label: "Flashcards",
    capabilities: [
      "flashcard.list",
      "flashcard.createDeck",
      "flashcard.createCards",
      "flashcard.update",
      "flashcard.delete",
      "flashcard.publish",
      "flashcard.generateFromBank",
    ],
    risk: { ...READ, ...CONTENT_WRITE, bulkCreate: "confirm" },
    serviceHint: "instructorFlashcardsApi / generateFromBank",
    route: "/module/flashcards",
    denied: ["edit_student_personal_decks"],
  },
  practice: {
    module: "practice",
    version: 1,
    label: "Practice",
    capabilities: [
      "practice.listTopics",
      "practice.configure",
      "practice.analyze",
    ],
    risk: { ...READ, ...CONTENT_WRITE, configure: "confirm" },
    serviceHint: "instructor practice APIs",
    route: "/module/practice",
    denied: ["practice.createTopic", "practice.createQuestions"],
    notes: "Topics come from the question bank. Mobile configures availability, daily limits, and analytics.",
  },
  playground: {
    module: "playground",
    version: 1,
    label: "Playground",
    capabilities: [
      "playground.createSession",
      "playground.populatePool",
      "playground.configure",
      "playground.inspectResults",
    ],
    risk: { ...READ, create: "confirm", configure: "confirm", update: "confirm" },
    serviceHint: "instructor playground service",
    route: "/module/playground",
    denied: [],
  },
  groups: {
    module: "groups",
    version: 1,
    label: "Groups",
    capabilities: [
      "group.list",
      "group.create",
      "group.assignStudents",
      "group.autoBalance",
      "group.updateMembership",
    ],
    risk: { ...READ, create: "confirm", update: "confirm", delete: "high" },
    serviceHint: "instructor groups service",
    route: "/module/groups",
    denied: [],
  },
  projects: {
    module: "projects",
    version: 1,
    label: "Projects",
    capabilities: [
      "project.create",
      "project.update",
      "project.configureDeadlines",
      "project.configureTeams",
      "project.configureDeliverables",
    ],
    risk: { ...READ, create: "confirm", update: "confirm", configure: "confirm", delete: "high" },
    serviceHint: "instructor projects service",
    route: "/module/projects",
    denied: [],
  },
  "course-exchange": {
    module: "course-exchange",
    version: 1,
    label: "Course Exchange",
    capabilities: [
      "courseExchange.discover",
      "courseExchange.request",
      "courseExchange.approve",
      "courseExchange.reject",
      "courseExchange.importCopy",
      "courseExchange.configureSharing",
    ],
    risk: { ...READ, create: "confirm", approve: "confirm", update: "confirm", delete: "forbidden" },
    serviceHint: "instructor course-exchange APIs + clone engine",
    route: "/module/course-exchange",
    denied: ["courseExchange.bypassApproval", "courseExchange.copyStudentData"],
    notes:
      "Share teaching content only. Creator must approve modules. Import creates an independent copy — never shared DB ownership.",
    toolHints: [
      "list_discoverable_courses",
      "propose_course_exchange_request",
      "propose_course_exchange_approval",
      "propose_course_exchange_import",
    ],
  },
  "summer-camp": {
    module: "summer-camp",
    version: 1,
    label: "Summer Camp",
    capabilities: ["summerCamp.read", "summerCamp.manage"],
    risk: { ...READ, create: "confirm", update: "confirm", publish: "high" },
    serviceHint: "summer-camp instructor APIs",
    route: "/module/summer-camp",
    denied: [],
    notes: "Campers drawer (/module/campers) is the same hub scoped to Campers + Inbox.",
  },
  campers: {
    module: "campers",
    version: 1,
    label: "Campers",
    capabilities: ["summerCamp.read", "summerCamp.manage"],
    risk: { ...READ, create: "confirm", update: "confirm", publish: "high" },
    serviceHint: "summer-camp instructor APIs",
    route: "/module/campers",
    denied: [],
    notes: "Alias of Summer Camp. Use summerCamp.read / summerCamp.manage; writes stay in the Campers UI.",
  },
  "question-bank": {
    module: "question-bank",
    version: 1,
    label: "Question Bank",
    capabilities: [
      "question.list",
      "question.search",
      "question.read",
      "question.create",
      "question.update",
      "question.softDelete",
      "question.restore",
      "question.validate",
      "question.preview",
      "question.bulkCreate",
    ],
    risk: {
      ...READ,
      create: "confirm",
      update: "confirm",
      bulkCreate: "confirm",
      delete: "high",
      archive: "confirm",
      restore: "confirm",
      validate: "none",
      preview: "none",
    },
    serviceHint: "bulkCreateQuestionBankQuestions / question-bank routes (real schemas)",
    route: "/module/question-bank",
    denied: ["raw_sql", "cross_course_bank_without_access"],
    notes:
      "Use CourseCollab question types/schemas (mcq, true_false, select_all, multi_part, circuit_submission, …). Never invent a parallel schema. Free keeps questionBank CRUD in the UI; Cora AI draft/bulk-create tools require aiQuestionGenerator (Pro+).",
  },
  quizzes: {
    module: "quizzes",
    version: 1,
    label: "Quizzes",
    capabilities: [
      "assessment.create",
      "assessment.update",
      "assessment.addQuestions",
      "assessment.removeQuestion",
      "assessment.configureAvailability",
      "assessment.configureAttempts",
      "assessment.preview",
      "assessment.publish",
      "assessment.unpublish",
      "assessment.grantExtension",
    ],
    risk: { ...ASSESS_WRITE },
    serviceHint: "createQuizFromBank / instructor quiz APIs",
    route: "/module/quizzes",
    denied: [],
  },
  homework: {
    module: "homework",
    version: 1,
    label: "Homework",
    capabilities: [
      "assessment.create",
      "assessment.update",
      "assessment.addQuestions",
      "assessment.removeQuestion",
      "assessment.configureAvailability",
      "assessment.configureAttempts",
      "assessment.preview",
      "assessment.publish",
      "assessment.unpublish",
    ],
    risk: { ...ASSESS_WRITE },
    serviceHint: "homework_from_bank / instructor homework APIs",
    route: "/module/homework",
    denied: [],
  },
  "mid-semester-exams": {
    module: "mid-semester-exams",
    version: 1,
    label: "Mid-Semester",
    capabilities: [
      "assessment.create",
      "assessment.update",
      "assessment.addQuestions",
      "assessment.removeQuestion",
      "assessment.configureAvailability",
      "assessment.configureAttempts",
      "assessment.preview",
      "assessment.publish",
      "assessment.unpublish",
    ],
    risk: {
      ...ASSESS_WRITE,
      publish: "high",
      update: "high",
      delete: "high",
    },
    serviceHint: "instructor mid-semester assessment APIs",
    route: "/module/mid-semester-exams",
    denied: [],
    notes: "Stronger confirmation around publishing/changes.",
  },
  "final-exams": {
    module: "final-exams",
    version: 1,
    label: "Finals",
    capabilities: [
      "assessment.create",
      "assessment.update",
      "assessment.addQuestions",
      "assessment.configureAvailability",
      "assessment.preview",
      "assessment.publish",
    ],
    risk: {
      ...ASSESS_WRITE,
      publish: "high",
      update: "high",
      delete: "high",
      configure: "high",
    },
    serviceHint: "instructor final exam APIs",
    route: "/module/final-exams",
    denied: [],
    notes: "High-risk confirmation required for publish/configure.",
  },
  "classroom-points": {
    module: "classroom-points",
    version: 1,
    label: "Classroom Points",
    capabilities: [
      "points.createAssignment",
      "points.reviewPending",
      "points.award",
      "points.approve",
    ],
    risk: { ...READ, create: "confirm", award: "high", approve: "high" },
    serviceHint: "instructor classroom-points APIs",
    route: "/module/classroom-points",
    denied: [],
  },
  "course-evaluations": {
    module: "course-evaluations",
    version: 1,
    label: "Evaluations",
    capabilities: ["evaluation.analyze", "evaluation.process"],
    risk: { ...READ, update: "confirm", configure: "confirm" },
    serviceHint: "instructor course-evaluations APIs",
    route: "/module/course-evaluations",
    denied: [],
  },
  attendance: {
    module: "attendance",
    version: 1,
    label: "Attendance",
    capabilities: [
      "attendance.createSession",
      "attendance.inspect",
      "attendance.correct",
    ],
    risk: { ...READ, create: "confirm", update: "high" },
    serviceHint: "instructor attendance APIs",
    route: "/module/attendance",
    denied: ["fabricate_attendance_outside_validation"],
  },
  students: {
    module: "students",
    version: 1,
    label: "Student Directory",
    capabilities: ["roster.search", "roster.read", "roster.summarize"],
    risk: { ...READ },
    serviceHint: "instructor roster / students APIs (assigned course only)",
    route: "/module/students",
    denied: ["other_instructor_private_roster", "student_passwords"],
    notes: "list_faculty_access_requests (read). propose_faculty_access_request_decision requires UI confirm.",
    toolHints: ["list_faculty_access_requests", "propose_faculty_access_request_decision"],
  },
  "office-hours": {
    module: "office-hours",
    version: 1,
    label: "Office Hours",
    capabilities: [
      "officeHours.manageAvailability",
      "officeHours.approve",
      "officeHours.decline",
      "officeHours.createMeeting",
    ],
    risk: { ...READ, create: "confirm", update: "confirm", approve: "confirm" },
    serviceHint: "instructor office-hours APIs",
    route: "/module/office-hours",
    denied: [],
    notes: "Approve, decline, create-on-behalf, and availability via propose_faculty_capability.",
  },
  recommendations: {
    module: "recommendations",
    version: 1,
    label: "Recommendations",
    capabilities: [
      "recommendation.read",
      "recommendation.draft",
      "recommendation.updateStatus",
    ],
    risk: { ...READ, create: "confirm", update: "confirm" },
    serviceHint: "instructor recommendations APIs",
    route: "/module/recommendations",
    denied: ["recommendation.send"],
    notes: "Send/notify remains denied. Draft and updateStatus are wired via propose_faculty_capability.",
  },
  "trade-center": {
    module: "trade-center",
    version: 1,
    label: "Trade Center",
    capabilities: ["trade.managePerks", "trade.manageRedemptions", "trade.manageRules"],
    risk: { ...READ, update: "confirm", configure: "high" },
    serviceHint: "instructor trade-center APIs",
    route: "/module/trade-center",
    denied: ["change_conversion_rules", "change_balances_directly"],
    notes: "Conversion rules and direct balance changes remain denied. managePerks/manageRedemptions/manageRules wired via Cora confirm.",
  },
  results: {
    module: "results",
    version: 1,
    label: "Results",
    capabilities: [
      "results.analyze",
      "results.diagnoseQuestions",
      "results.proposeRegrade",
      "results.regrade",
    ],
    risk: { ...READ, regrade: "high", update: "high" },
    serviceHint: "instructor results / grading APIs",
    route: "/module/results",
    minTier: "Pro",
    denied: ["cross_course_results"],
    notes: "Mobile finalize, email, recalculate, and bulk re-evaluate. Per-question override edit is web-only.",
  },
  "student-progress": {
    module: "student-progress",
    version: 1,
    label: "Class Analytics",
    capabilities: [
      "progress.analyze",
      "progress.identifyAtRisk",
      "progress.recommendInterventions",
    ],
    risk: { ...READ },
    serviceHint: "instructor student-progress analytics",
    route: "/module/student-progress",
    minTier: "Pro",
    denied: [],
  },
  reports: {
    module: "reports",
    version: 1,
    label: "Reports",
    capabilities: ["report.generate", "report.export"],
    risk: { ...READ, export: "confirm" },
    serviceHint: "instructor reports APIs",
    route: "/module/reports",
    minTier: "Pro",
    denied: [],
  },
  "progress-reviews": {
    module: "progress-reviews",
    version: 1,
    label: "Progress Reviews",
    capabilities: [
      "progressReview.draft",
      "progressReview.edit",
      "progressReview.save",
      "progressReview.publish",
    ],
    risk: { ...READ, create: "confirm", update: "confirm", publish: "high", send: "high" },
    serviceHint: "midterm-progress-review / progress-reviews APIs",
    route: "/module/progress-reviews",
    minTier: "Pro",
    denied: [],
  },
  "recent-activity": {
    module: "recent-activity",
    version: 1,
    label: "Recent Activity",
    capabilities: ["activity.search", "activity.analyze"],
    risk: { ...READ },
    serviceHint: "instructor recent-activity APIs",
    route: "/module/recent-activity",
    denied: [],
  },
  notifications: {
    module: "notifications",
    version: 1,
    label: "Notifications",
    capabilities: ["notification.list", "notification.read", "notification.manage"],
    risk: { ...READ, update: "confirm", delete: "confirm" },
    serviceHint: "instructor notifications APIs",
    route: "/module/notifications",
    denied: [],
  },
  messages: {
    module: "messages",
    version: 1,
    label: "Messages",
    capabilities: ["message.search", "message.draft", "message.send"],
    risk: { ...READ, create: "confirm", send: "high" },
    serviceHint: "instructor messages APIs",
    route: "/module/messages",
    denied: ["read_unrelated_private_threads"],
  },
  discussions: {
    module: "discussions",
    version: 1,
    label: "Discussions",
    capabilities: [
      "discussion.create",
      "discussion.moderate",
      "discussion.pin",
      "discussion.update",
    ],
    risk: { ...READ, create: "confirm", update: "confirm", delete: "high" },
    serviceHint: "instructor discussions APIs",
    route: "/module/discussions",
    denied: [],
  },
  "student-support": {
    module: "student-support",
    version: 1,
    label: "Student Support",
    capabilities: ["support.process"],
    risk: { ...READ, update: "confirm", approve: "confirm" },
    serviceHint: "instructor student-support workflows",
    route: "/module/student-support",
    denied: [],
  },
  "course-settings": {
    module: "course-settings",
    version: 1,
    label: "Course Settings",
    capabilities: ["courseSettings.read", "courseSettings.updateSafe"],
    risk: { ...READ, update: "confirm", configure: "confirm" },
    serviceHint: "instructor course-settings APIs",
    route: "/module/course-settings",
    denied: ["billing", "institution_admin"],
  },
  "assessment-governance": {
    module: "assessment-governance",
    version: 1,
    label: "Assessment Governance",
    capabilities: ["governance.read", "governance.update"],
    risk: { ...READ, update: "high", configure: "high" },
    serviceHint: "assessment-governance APIs",
    route: "/module/assessment-governance",
    denied: [],
  },
  "assessment-defaults": {
    module: "assessment-defaults",
    version: 1,
    label: "Assessment Defaults",
    capabilities: ["defaults.read", "defaults.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "assessment-defaults APIs",
    route: "/module/assessment-defaults",
    denied: [],
  },
  "grading-policies": {
    module: "grading-policies",
    version: 1,
    label: "Grading Policies",
    capabilities: ["gradingPolicy.analyze", "gradingPolicy.update"],
    risk: { ...READ, update: "high", configure: "high" },
    serviceHint: "grading-policies APIs",
    route: "/module/grading-policies",
    denied: [],
  },
  "attendance-policies": {
    module: "attendance-policies",
    version: 1,
    label: "Attendance Policies",
    capabilities: ["attendancePolicy.read", "attendancePolicy.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "attendance-policies APIs",
    route: "/module/attendance-policies",
    denied: [],
  },
  "classroom-points-rules": {
    module: "classroom-points-rules",
    version: 1,
    label: "Points Rules",
    capabilities: ["pointsRules.read", "pointsRules.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "classroom-points-rules APIs",
    route: "/module/classroom-points-rules",
    denied: [],
  },
  "playground-rules": {
    module: "playground-rules",
    version: 1,
    label: "Playground Rules",
    capabilities: ["playgroundRules.read", "playgroundRules.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "playground-rules APIs",
    route: "/module/playground-rules",
    denied: [],
  },
  "ai-assistant-settings": {
    module: "ai-assistant-settings",
    version: 1,
    label: "Cora Assistant Settings",
    capabilities: ["coraPolicy.read", "coraPolicy.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "ai-assistant-settings / course Cora policies",
    route: "/module/ai-assistant-settings",
    minTier: "Pro",
    denied: ["platform_ai_governance"],
  },
  "team-project-policies": {
    module: "team-project-policies",
    version: 1,
    label: "Project Policies",
    capabilities: ["projectPolicy.read", "projectPolicy.update"],
    risk: { ...READ, update: "confirm" },
    serviceHint: "team-project-policies APIs",
    route: "/module/team-project-policies",
    denied: [],
  },
  "submission-issues": {
    module: "submission-issues",
    version: 1,
    label: "Submission Issues",
    capabilities: ["submissionIssue.diagnose", "submissionIssue.resolve"],
    risk: { ...READ, update: "confirm", approve: "high" },
    serviceHint: "submission-issues APIs",
    route: "/module/submission-issues",
    denied: [],
  },
  "teaching-assistants": {
    module: "teaching-assistants",
    version: 1,
    label: "Teaching Assistants",
    capabilities: ["ta.list", "ta.manage"],
    risk: { ...READ, create: "high", update: "high", delete: "high" },
    serviceHint: "teaching-assistants APIs",
    route: "/module/teaching-assistants",
    minTier: "Teams",
    denied: ["grant_platform_admin"],
  },
  membership: {
    module: "membership",
    version: 1,
    label: "Membership",
    capabilities: ["membership.explain"],
    risk: { ...READ },
    serviceHint: "faculty membership plans UI",
    route: "/membership",
    denied: ["change_other_instructor_billing"],
  },
  "help-center": {
    module: "help-center",
    version: 1,
    label: "Help Center",
    capabilities: ["help.read"],
    risk: { ...READ },
    serviceHint: "help center",
    route: "/module/help-center",
    denied: [],
  },
  "submit-ticket": {
    module: "submit-ticket",
    version: 1,
    label: "Submit Ticket",
    capabilities: ["ticket.create", "ticket.readOwn"],
    risk: { ...READ, create: "confirm" },
    serviceHint: "support ticket APIs",
    route: "/module/submit-ticket",
    denied: ["access_other_users_tickets"],
  },
  "report-bug": {
    module: "report-bug",
    version: 1,
    label: "Report Bug",
    capabilities: ["bug.create"],
    risk: { create: "confirm" },
    serviceHint: "bug report APIs",
    route: "/module/report-bug",
    denied: [],
  },
  "feature-requests": {
    module: "feature-requests",
    version: 1,
    label: "Feature Requests",
    capabilities: ["featureRequest.create"],
    risk: { create: "confirm" },
    serviceHint: "feature request APIs",
    route: "/module/feature-requests",
    denied: [],
  },
}

export const FACULTY_CORA_AUTHORIZATION_PRINCIPLE = `
Faculty Cora is an authenticated teaching agent.

Authenticated Faculty
        ↓
Role Permissions
        ↓
Institution Scope
        ↓
Course Assignment
        ↓
Membership Tier
        ↓
Module Permission
        ↓
Resource Ownership
        ↓
Cora Capability

Cora does NOT reproduce Quiz/Announcement/QB business logic.
Cora invokes the same CourseCollab services as the Web and Mobile editors.

Risk policy:
- none: reads, searches, summaries, analytics, previews
- confirm: reversible drafts/content creates/updates
- high: publish, send, grades, policies, deletes, awards, attendance corrections
- forbidden: outside instructor institution/course/section/role/membership scope

Never say "I can't publish announcements" (or similar) when the capability
registry grants announcement.publish for this principal.
`.trim()

const TIER_RANK: Record<FacultyMembershipTier, number> = {
  Free: 0,
  Pro: 1,
  Teams: 2,
}

export function facultyTierAllows(
  tier: FacultyMembershipTier | null | undefined,
  minTier?: FacultyMembershipTier,
): boolean {
  if (!minTier) return true
  const current = tier ?? "Free"
  return TIER_RANK[current] >= TIER_RANK[minTier]
}

export function getFacultyModuleCapability(
  moduleId: string,
): FacultyCoraModuleCapability | null {
  return FACULTY_CORA_MODULE_REGISTRY[moduleId as FacultyCoraModuleId] ?? null
}

export function facultyModuleHasCapability(
  moduleId: FacultyCoraModuleId,
  capabilityId: string,
): boolean {
  const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId]
  return mod?.capabilities.includes(capabilityId) ?? false
}

/** Whether Faculty Cora may perform this operation family on the module. */
export function facultyModuleAllows(
  moduleId: FacultyCoraModuleId,
  operation: FacultyCoraOperation,
): boolean {
  const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId]
  if (!mod) return false
  if (mod.denied.includes(operation)) return false
  if (mod.risk[operation] != null) return true
  return mod.capabilities.some(
    (c) => c === operation || c.endsWith(`.${operation}`),
  )
}

export function facultyRiskFor(
  moduleId: FacultyCoraModuleId,
  operation: FacultyCoraOperation,
): FacultyRiskLevel {
  const mod = FACULTY_CORA_MODULE_REGISTRY[moduleId]
  return mod?.risk[operation] ?? "confirm"
}

/** Default modules injected into Faculty Cora system prompts (Phase-2 live + high-priority). */
export const DEFAULT_FACULTY_CAPABILITY_MODULES: FacultyCoraModuleId[] = [
  "dashboard",
  "announcements",
  "question-bank",
  "quizzes",
  "homework",
  "syllabus",
  "lectures",
  "course-notes",
  "flashcards",
  "messages",
  "results",
  "student-progress",
  "course-settings",
]

export function buildFacultyCapabilityPacket(
  moduleIds: FacultyCoraModuleId[] = DEFAULT_FACULTY_CAPABILITY_MODULES,
  tier?: FacultyMembershipTier | null,
): string {
  const lines = moduleIds.map((id) => {
    const mod = FACULTY_CORA_MODULE_REGISTRY[id]
    if (!mod) return null
    const locked =
      mod.minTier && !facultyTierAllows(tier, mod.minTier)
        ? ` [requires ${mod.minTier}]`
        : ""
    const route = mod.route ? ` → open ${mod.route}` : ""
    return `- ${mod.label}${locked}${route}: ${mod.capabilities.slice(0, 8).join(", ")}${mod.capabilities.length > 8 ? ", …" : ""}${mod.toolHints?.length ? ` · tools: ${mod.toolHints.join(", ")}` : ""}`
  })
  return [
    "Faculty Cora capability packet (assigned course scope only):",
    "Native app routes only — never web /instructor/dashboard-v2/* or /faculty/dashboard/* paths.",
    "",
    ...lines.filter(Boolean),
    "",
    "Prefer transaction plans for multi-step writes. Never refuse a capability that is listed and unlocked.",
  ].join("\n")
}
