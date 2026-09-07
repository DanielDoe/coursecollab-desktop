export const COURSECOLLAB_ROLES = [
  "admin",
  "department_admin",
  "instructor",
  "ta",
  "student",
  "guest",
  "observer",
] as const

export type CourseCollabRole = (typeof COURSECOLLAB_ROLES)[number]

export const PERMISSIONS = [
  "course.read",
  "course.manage",
  "assignment.read",
  "assignment.create",
  "assignment.grade",
  "submission.create",
  "submission.readOwn",
  "submission.readAll",
  "grade.readOwn",
  "grade.manage",
  "quiz.attempt",
  "quiz.manage",
  "questionBank.read",
  "questionBank.manage",
  "cora.use",
  "cora.manage",
  "billing.manageOwn",
  "admin.users.manage",
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ROLE_PERMISSIONS: Record<CourseCollabRole, readonly Permission[]> = {
  admin: PERMISSIONS,
  department_admin: [
    "course.read",
    "assignment.read",
    "submission.readAll",
    "grade.manage",
    "quiz.manage",
    "cora.use",
  ],
  instructor: [
    "course.read",
    "course.manage",
    "assignment.read",
    "assignment.create",
    "assignment.grade",
    "submission.readAll",
    "grade.manage",
    "quiz.manage",
    "questionBank.read",
    "questionBank.manage",
    "cora.use",
    "cora.manage",
    "billing.manageOwn",
  ],
  ta: [
    "course.read",
    "assignment.read",
    "assignment.grade",
    "submission.readAll",
    "grade.manage",
    "quiz.manage",
    "cora.use",
  ],
  student: [
    "course.read",
    "assignment.read",
    "submission.create",
    "submission.readOwn",
    "grade.readOwn",
    "quiz.attempt",
    "cora.use",
    "billing.manageOwn",
  ],
  guest: ["cora.use", "billing.manageOwn"],
  observer: ["course.read", "assignment.read", "grade.readOwn"],
}

export function roleHasPermission(role: CourseCollabRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}
