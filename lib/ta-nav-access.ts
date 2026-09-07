import type { RbacPermissionCode } from "@/lib/rbac-permission-codes"
import { TA_KEY_TO_PERMISSION_CODE, PERMISSION_CODE_TO_TA_KEY } from "@/lib/rbac-permission-codes"
import {
  DEFAULT_TA_PERMISSIONS,
  TA_PERMISSION_KEYS,
  type TaPermissionKey,
  type TaPermissionSet,
} from "@/lib/ta-permissions"

/** Sidebar / route modules instructors can grant to TAs per course */
export type TaNavModuleId =
  | "quizzes"
  | "question-bank"
  | "homeworks"
  | "mid-semester"
  | "final-exams"
  | "classroom-points"
  | "attendance"
  | "lectures"
  | "practice"
  | "playground"
  | "groups"
  | "projects"
  | "announcements"
  | "syllabus"
  | "discussions"
  | "results"

export type TaModuleGrantLevel = "crud" | "publish"

export type TaNavModuleConfig = {
  label: string
  /** Any of these unlocks the module in the sidebar */
  navVisibleCodes: RbacPermissionCode[]
  /** Granted when instructor enables Access (create/edit, no student release) */
  crudGrantCodes: RbacPermissionCode[]
  /** Granted when instructor enables Publish (release to students) */
  publishGrantCodes: RbacPermissionCode[]
  /** Legacy TaPermissionKey toggles synced to course_staff_permissions */
  crudGrantKeys: TaPermissionKey[]
  publishGrantKeys: TaPermissionKey[]
}

const QUIZ_ASSESSMENT_CRUD: RbacPermissionCode[] = [
  "edit_quizzes",
  "grade_exams",
  "grade_assignments",
  "review_submissions",
  "view_assessments",
]
const QUIZ_ASSESSMENT_PUBLISH: RbacPermissionCode[] = ["publish_quizzes"]
const QUIZ_ASSESSMENT_CRUD_KEYS: TaPermissionKey[] = [
  "canEditQuizzes",
  "canGradeExams",
  "canGradeAssignments",
  "canViewAssessments",
]
const QUIZ_ASSESSMENT_PUBLISH_KEYS: TaPermissionKey[] = ["canPublishQuizzes"]

const HOMEWORK_CRUD: RbacPermissionCode[] = [
  "edit_homework",
  "grade_assignments",
  "review_submissions",
  "view_assessments",
]
const HOMEWORK_PUBLISH: RbacPermissionCode[] = ["publish_homework"]
const HOMEWORK_CRUD_KEYS: TaPermissionKey[] = ["canEditHomework", "canGradeAssignments", "canViewAssessments"]
const HOMEWORK_PUBLISH_KEYS: TaPermissionKey[] = ["canPublishHomework"]

export const TA_NAV_MODULE_CONFIG: Record<TaNavModuleId, TaNavModuleConfig> = {
  quizzes: {
    label: "Manage Quizzes",
    navVisibleCodes: [...QUIZ_ASSESSMENT_CRUD, ...QUIZ_ASSESSMENT_PUBLISH],
    crudGrantCodes: QUIZ_ASSESSMENT_CRUD,
    publishGrantCodes: QUIZ_ASSESSMENT_PUBLISH,
    crudGrantKeys: QUIZ_ASSESSMENT_CRUD_KEYS,
    publishGrantKeys: QUIZ_ASSESSMENT_PUBLISH_KEYS,
  },
  "question-bank": {
    label: "Question Bank",
    navVisibleCodes: [...QUIZ_ASSESSMENT_CRUD, ...QUIZ_ASSESSMENT_PUBLISH],
    crudGrantCodes: QUIZ_ASSESSMENT_CRUD,
    publishGrantCodes: QUIZ_ASSESSMENT_PUBLISH,
    crudGrantKeys: QUIZ_ASSESSMENT_CRUD_KEYS,
    publishGrantKeys: QUIZ_ASSESSMENT_PUBLISH_KEYS,
  },
  homeworks: {
    label: "Manage Homework",
    navVisibleCodes: [...HOMEWORK_CRUD, ...HOMEWORK_PUBLISH],
    crudGrantCodes: HOMEWORK_CRUD,
    publishGrantCodes: HOMEWORK_PUBLISH,
    crudGrantKeys: HOMEWORK_CRUD_KEYS,
    publishGrantKeys: HOMEWORK_PUBLISH_KEYS,
  },
  "mid-semester": {
    label: "Mid-Semester Exams",
    navVisibleCodes: [...QUIZ_ASSESSMENT_CRUD, ...QUIZ_ASSESSMENT_PUBLISH],
    crudGrantCodes: QUIZ_ASSESSMENT_CRUD,
    publishGrantCodes: QUIZ_ASSESSMENT_PUBLISH,
    crudGrantKeys: QUIZ_ASSESSMENT_CRUD_KEYS,
    publishGrantKeys: QUIZ_ASSESSMENT_PUBLISH_KEYS,
  },
  "final-exams": {
    label: "Final Exams",
    navVisibleCodes: [...QUIZ_ASSESSMENT_CRUD, ...QUIZ_ASSESSMENT_PUBLISH],
    crudGrantCodes: QUIZ_ASSESSMENT_CRUD,
    publishGrantCodes: QUIZ_ASSESSMENT_PUBLISH,
    crudGrantKeys: QUIZ_ASSESSMENT_CRUD_KEYS,
    publishGrantKeys: QUIZ_ASSESSMENT_PUBLISH_KEYS,
  },
  "classroom-points": {
    label: "Classroom Points",
    navVisibleCodes: ["manage_classroom_points", "publish_classroom_points"],
    crudGrantCodes: ["manage_classroom_points"],
    publishGrantCodes: ["publish_classroom_points"],
    crudGrantKeys: ["canManageClassroomPoints"],
    publishGrantKeys: ["canPublishClassroomPoints"],
  },
  attendance: {
    label: "Attendance",
    navVisibleCodes: ["take_attendance", "manage_attendance"],
    crudGrantCodes: ["take_attendance", "manage_attendance"],
    publishGrantCodes: [],
    crudGrantKeys: ["canTakeAttendance", "canManageAttendance"],
    publishGrantKeys: [],
  },
  lectures: {
    label: "Manage Lectures",
    navVisibleCodes: ["manage_lectures", "view_course_content"],
    crudGrantCodes: ["manage_lectures"],
    publishGrantCodes: [],
    crudGrantKeys: ["canManageLectures"],
    publishGrantKeys: [],
  },
  practice: {
    label: "Manage Practice",
    navVisibleCodes: ["manage_practice_content", "view_course_content"],
    crudGrantCodes: ["manage_practice_content"],
    publishGrantCodes: [],
    crudGrantKeys: ["canManagePracticeContent"],
    publishGrantKeys: [],
  },
  playground: {
    label: "Manage Playground",
    navVisibleCodes: ["manage_playground", "view_course_content"],
    crudGrantCodes: ["manage_playground"],
    publishGrantCodes: [],
    crudGrantKeys: ["canManagePlayground"],
    publishGrantKeys: [],
  },
  groups: {
    label: "Manage Groups",
    navVisibleCodes: ["manage_groups"],
    crudGrantCodes: ["manage_groups"],
    publishGrantCodes: [],
    crudGrantKeys: ["canManageGroups"],
    publishGrantKeys: [],
  },
  projects: {
    label: "Manage Projects",
    navVisibleCodes: ["manage_projects"],
    crudGrantCodes: ["manage_projects"],
    publishGrantCodes: [],
    crudGrantKeys: ["canManageProjects"],
    publishGrantKeys: [],
  },
  announcements: {
    label: "Announcements",
    navVisibleCodes: ["publish_announcements", "draft_announcements"],
    crudGrantCodes: ["draft_announcements"],
    publishGrantCodes: ["publish_announcements"],
    crudGrantKeys: ["canDraftAnnouncements"],
    publishGrantKeys: ["canPublishAnnouncements"],
  },
  syllabus: {
    label: "Syllabus",
    navVisibleCodes: ["manage_syllabus", "manage_course_settings", "view_course_content"],
    crudGrantCodes: ["manage_syllabus", "manage_course_settings"],
    publishGrantCodes: ["manage_syllabus", "manage_course_settings"],
    crudGrantKeys: ["canManageSyllabus"],
    publishGrantKeys: ["canManageSyllabus"],
  },
  discussions: {
    label: "Course Discussions",
    navVisibleCodes: ["moderate_discussions"],
    crudGrantCodes: ["moderate_discussions"],
    publishGrantCodes: [],
    crudGrantKeys: ["canModerateDiscussions"],
    publishGrantKeys: [],
  },
  results: {
    label: "Manage Results",
    navVisibleCodes: ["view_analytics"],
    crudGrantCodes: ["view_analytics"],
    publishGrantCodes: [],
    crudGrantKeys: ["canViewAnalytics"],
    publishGrantKeys: [],
  },
}

/** Map faculty nav item id → TA module (when they differ, e.g. homeworks → homeworks) */
export const FACULTY_NAV_ITEM_TO_TA_MODULE: Record<string, TaNavModuleId> = {
  quizzes: "quizzes",
  "question-bank": "question-bank",
  homeworks: "homeworks",
  "mid-semester": "mid-semester",
  "final-exams": "final-exams",
  "classroom-points": "classroom-points",
  attendance: "attendance",
  lectures: "lectures",
  practice: "practice",
  playground: "playground",
  groups: "groups",
  projects: "projects",
  announcements: "announcements",
  syllabus: "syllabus",
  discussions: "discussions",
  results: "results",
  "advanced-analytics": "results",
  reports: "results",
}

const FACULTY_BASE = "/faculty/dashboard"

const INSTRUCTOR_V2 = "/instructor/dashboard-v2"

const TA_PATH_PREFIX_RULES: { prefix: string; moduleId: TaNavModuleId }[] = [
  { prefix: `${FACULTY_BASE}/assessments/quizzes`, moduleId: "quizzes" },
  { prefix: `${INSTRUCTOR_V2}/assessments/quizzes`, moduleId: "quizzes" },
  { prefix: `${FACULTY_BASE}/assessments/homework`, moduleId: "homeworks" },
  { prefix: `${INSTRUCTOR_V2}/assessments/homework`, moduleId: "homeworks" },
  { prefix: `${FACULTY_BASE}/assessments/mid-semester`, moduleId: "mid-semester" },
  { prefix: `${INSTRUCTOR_V2}/assessments/mid-semester`, moduleId: "mid-semester" },
  { prefix: `${FACULTY_BASE}/assessments/finals`, moduleId: "final-exams" },
  { prefix: `${INSTRUCTOR_V2}/assessments/finals`, moduleId: "final-exams" },
  { prefix: `${FACULTY_BASE}/assessments/classroom-points`, moduleId: "classroom-points" },
  { prefix: `${INSTRUCTOR_V2}/assessments/classroom-points`, moduleId: "classroom-points" },
  { prefix: `${FACULTY_BASE}/assessments/attendance`, moduleId: "attendance" },
  { prefix: `${INSTRUCTOR_V2}/assessments/attendance`, moduleId: "attendance" },
  { prefix: `${FACULTY_BASE}/content/lectures`, moduleId: "lectures" },
  { prefix: `${FACULTY_BASE}/content/practice`, moduleId: "practice" },
  { prefix: `${FACULTY_BASE}/course/playground`, moduleId: "playground" },
  { prefix: `${FACULTY_BASE}/management/groups`, moduleId: "groups" },
  { prefix: `${FACULTY_BASE}/management/projects`, moduleId: "projects" },
  { prefix: `${FACULTY_BASE}/communication/announcements`, moduleId: "announcements" },
  { prefix: `${FACULTY_BASE}/content/syllabus`, moduleId: "syllabus" },
  { prefix: `${FACULTY_BASE}/communication/discussions`, moduleId: "discussions" },
  { prefix: `${FACULTY_BASE}/results`, moduleId: "results" },
  { prefix: `${FACULTY_BASE}/analytics/`, moduleId: "results" },
]

export type TaModuleGrantState = { crud: boolean; publish: boolean }

export function hasAnyPermissionCode(effective: Set<string>, codes: RbacPermissionCode[]): boolean {
  if (codes.length === 0) return false
  return codes.some((c) => effective.has(c))
}

export function hasAllPermissionCodes(effective: Set<string>, codes: RbacPermissionCode[]): boolean {
  if (codes.length === 0) return true
  return codes.every((c) => effective.has(c))
}

/** CRUD = any crud code; publish = any publish code (modules with no publish codes never show publish on) */
export function buildTaModuleGrantState(effectiveCodes: string[]): Record<TaNavModuleId, TaModuleGrantState> {
  const effective = new Set(effectiveCodes)
  const out = {} as Record<TaNavModuleId, TaModuleGrantState>
  for (const id of Object.keys(TA_NAV_MODULE_CONFIG) as TaNavModuleId[]) {
    const cfg = TA_NAV_MODULE_CONFIG[id]
    out[id] = {
      crud: hasAnyPermissionCode(effective, cfg.crudGrantCodes),
      publish:
        cfg.publishGrantCodes.length > 0 && hasAnyPermissionCode(effective, cfg.publishGrantCodes),
    }
  }
  return out
}

export function isTaNavModuleUnlocked(moduleId: TaNavModuleId, effectiveCodes: string[]): boolean {
  const cfg = TA_NAV_MODULE_CONFIG[moduleId]
  return hasAnyPermissionCode(new Set(effectiveCodes), cfg.navVisibleCodes)
}

export function buildTaNavAccessMap(effectiveCodes: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const [navId, moduleId] of Object.entries(FACULTY_NAV_ITEM_TO_TA_MODULE)) {
    out[navId] = isTaNavModuleUnlocked(moduleId, effectiveCodes)
  }
  return out
}

export function permissionPatchForNavModuleLevel(
  moduleId: TaNavModuleId,
  level: TaModuleGrantLevel,
  enabled: boolean,
): Partial<Record<TaPermissionKey, boolean>> {
  const cfg = TA_NAV_MODULE_CONFIG[moduleId]
  const patch: Partial<Record<TaPermissionKey, boolean>> = {}
  const keys = level === "crud" ? cfg.crudGrantKeys : cfg.publishGrantKeys
  for (const key of keys) {
    patch[key] = enabled
  }
  if (level === "crud" && !enabled) {
    for (const key of cfg.publishGrantKeys) {
      patch[key] = false
    }
  }
  return patch
}

/** @deprecated Use permissionPatchForNavModuleLevel(moduleId, "crud", enabled) */
export function permissionPatchForNavModule(
  moduleId: TaNavModuleId,
  enabled: boolean,
): Partial<Record<TaPermissionKey, boolean>> {
  return permissionPatchForNavModuleLevel(moduleId, "crud", enabled)
}

export function taSetFromEffectivePermissionCodes(codes: string[]): TaPermissionSet {
  const effective = new Set(codes)
  const out = { ...DEFAULT_TA_PERMISSIONS }
  for (const key of TA_PERMISSION_KEYS) {
    const code = TA_KEY_TO_PERMISSION_CODE[key]
    if (code) out[key] = effective.has(code)
  }
  return out
}

export function isTaPathAllowedByPermissions(pathname: string, effectiveCodes: string[]): boolean {
  const effective = new Set(effectiveCodes)
  for (const { prefix, moduleId } of TA_PATH_PREFIX_RULES) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return isTaNavModuleUnlocked(moduleId, [...effective])
    }
  }
  const alwaysAllowed = [
    FACULTY_BASE,
    "/instructor/dashboard-v2",
    `${FACULTY_BASE}/management/sessions`,
    `${FACULTY_BASE}/management/students`,
    `${FACULTY_BASE}/learning-center/office-hours`,
    `${FACULTY_BASE}/learning-center/help`,
    `${FACULTY_BASE}/communication/notifications`,
    `${FACULTY_BASE}/settings`,
    `${FACULTY_BASE}/instructor/help`,
  ]
  if (alwaysAllowed.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true
  }
  return false
}

/** Permissions granted to every TA via course_staff.role = TA (before instructor overrides). */
export const TA_ROLE_DEFAULT_PERMISSION_CODES: RbacPermissionCode[] = [
  "grade_assignments",
  "draft_announcements",
  "manage_groups",
  "manage_attendance",
  "take_attendance",
  "hold_office_hours",
  "view_analytics",
  "manage_practice_content",
  "moderate_discussions",
  "manage_lectures",
  "review_submissions",
  "manage_projects",
  "manage_playground",
]

/** Grouped modules for the instructor Teaching Assistants admin UI */
export const TA_MODULE_UI_GROUPS: { title: string; moduleIds: TaNavModuleId[] }[] = [
  {
    title: "Assessments",
    moduleIds: [
      "quizzes",
      "question-bank",
      "homeworks",
      "mid-semester",
      "final-exams",
      "classroom-points",
      "attendance",
    ],
  },
  {
    title: "Course content",
    moduleIds: ["lectures", "practice", "playground", "groups", "projects"],
  },
  {
    title: "Communication & analytics",
    moduleIds: ["announcements", "discussions", "results"],
  },
]

export function isModuleIncludedInTaRole(moduleId: TaNavModuleId): boolean {
  return isTaNavModuleUnlocked(moduleId, TA_ROLE_DEFAULT_PERMISSION_CODES)
}

/** @deprecated Use buildTaModuleGrantState */
export function buildTaModuleAccessState(effectiveCodes: string[]): Record<TaNavModuleId, boolean> {
  const grants = buildTaModuleGrantState(effectiveCodes)
  const out = {} as Record<TaNavModuleId, boolean>
  for (const id of Object.keys(TA_NAV_MODULE_CONFIG) as TaNavModuleId[]) {
    out[id] = grants[id].crud || grants[id].publish
  }
  return out
}

export { PERMISSION_CODE_TO_TA_KEY }
