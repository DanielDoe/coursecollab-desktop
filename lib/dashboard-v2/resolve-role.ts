import { getAdminData, getInstructorData, getStudentData } from "@/lib/auth"
import { normalizePlatformRole } from "@/lib/roles"
import type { DashboardPortal, DashboardRoleKey } from "./types"

export function resolveDashboardRole(portal: DashboardPortal): DashboardRoleKey {
  if (portal === "admin") {
    const admin = getAdminData()
    const platformRole = normalizePlatformRole(admin?.platformRole)
    return platformRole === "DEPARTMENT_ADMIN" ? "department_admin" : "platform_admin"
  }

  if (portal === "student") {
    return "student"
  }

  if (portal === "camper") {
    const student = getStudentData()
    return student?.studentProgramRole === "summer_student" ? "summer_student" : "summer_camper"
  }

  const faculty = getInstructorData()
  const staffRole = faculty?.staffRoleForCourse?.toUpperCase()

  if (staffRole === "TA") return "ta"
  if (staffRole === "COURSE_OBSERVER") return "observer"
  if (faculty?.role === "department_admin") return "department_admin"
  return "instructor"
}
