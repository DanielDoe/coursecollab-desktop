import {
  normalizeCourseStaffRole,
  normalizeFacultyAccountRole,
  normalizePlatformRole,
  platformRoleLabel,
  courseStaffRoleLabel,
  type CourseStaffRole,
  type PlatformRole,
} from "@/lib/roles"

export type UserKind = "platform" | "faculty" | "student"

export type DirectoryPrimaryRole =
  | "PLATFORM_ADMIN"
  | "DEPARTMENT_ADMIN"
  | "INSTRUCTOR"
  | "TA"
  | "STUDENT"
  | "COURSE_OBSERVER"

export type CourseAssignment = {
  courseId: number
  courseCode: string
  courseTitle: string
  staffRole: CourseStaffRole
}

export function facultyAccountToPrimaryRole(accountRole: string | null | undefined): DirectoryPrimaryRole {
  const r = normalizeFacultyAccountRole(accountRole)
  if (r === "ta") return "TA"
  if (r === "department_admin") return "DEPARTMENT_ADMIN"
  return "INSTRUCTOR"
}

export function primaryRoleLabel(role: DirectoryPrimaryRole | string): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return platformRoleLabel("PLATFORM_ADMIN")
    case "DEPARTMENT_ADMIN":
      return platformRoleLabel("DEPARTMENT_ADMIN")
    case "INSTRUCTOR":
      return "Instructor"
    case "TA":
      return "Teaching Assistant"
    case "COURSE_OBSERVER":
      return "Observer"
    case "STUDENT":
      return "Student"
    default:
      return String(role)
  }
}

export function primaryRoleFromPlatform(role: string | null | undefined): DirectoryPrimaryRole {
  return normalizePlatformRole(role) as DirectoryPrimaryRole
}

export function accountRoleFromPrimaryRole(
  primaryRole: DirectoryPrimaryRole,
  userKind: UserKind,
): string {
  if (userKind === "platform") {
    return normalizePlatformRole(primaryRole) as PlatformRole
  }
  if (userKind === "student") return "student"
  switch (primaryRole) {
    case "TA":
      return "ta"
    case "DEPARTMENT_ADMIN":
      return "department_admin"
    default:
      return "instructor"
  }
}

export function formatCourseAssignment(a: CourseAssignment): string {
  return `${a.courseCode} (${courseStaffRoleLabel(a.staffRole)})`
}

export function resolveDisplayPrimaryRole(
  userKind: UserKind,
  accountRole: string | null | undefined,
  courseAssignments: CourseAssignment[],
): DirectoryPrimaryRole {
  if (userKind === "platform") return primaryRoleFromPlatform(accountRole)
  if (userKind === "student") return "STUDENT"
  const account = facultyAccountToPrimaryRole(accountRole)
  if (account !== "INSTRUCTOR") return account
  const onlyObserver =
    courseAssignments.length > 0 &&
    courseAssignments.every((c) => normalizeCourseStaffRole(c.staffRole) === "COURSE_OBSERVER")
  if (onlyObserver) return "COURSE_OBSERVER"
  return account
}

export const ADDABLE_PRIMARY_ROLES: {
  value: DirectoryPrimaryRole
  userKind: UserKind
  label: string
  description: string
}[] = [
  {
    value: "PLATFORM_ADMIN",
    userKind: "platform",
    label: "Platform Administrator",
    description: "Full platform access (users, billing, settings).",
  },
  {
    value: "DEPARTMENT_ADMIN",
    userKind: "platform",
    label: "Department Administrator",
    description: "Department courses, enrollments, and staff (no billing).",
  },
  {
    value: "INSTRUCTOR",
    userKind: "faculty",
    label: "Instructor",
    description: "Owns and manages assigned courses.",
  },
  {
    value: "TA",
    userKind: "faculty",
    label: "Teaching Assistant",
    description: "Assists instructors; per-course permissions are customizable.",
  },
  {
    value: "COURSE_OBSERVER",
    userKind: "faculty",
    label: "Observer",
    description: "Read-only access; assign to courses after account is created.",
  },
  {
    value: "STUDENT",
    userKind: "student",
    label: "Student",
    description: "Learner enrolled in courses.",
  },
]
