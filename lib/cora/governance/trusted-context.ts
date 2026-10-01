import { studentMayAccessEnrolledCourse } from "@/lib/tenant/types"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { resolveCourseTenant } from "@/lib/tenant/resource"
import { facultyMayAccessCourseByRelationship } from "@/lib/tenant/types"

export type TrustedCoraContext = {
  actorType: "student" | "faculty" | "institution" | "platform_admin" | "guest"
  actorId: number
  institutionId: number | null
  courseId: number | null
  sessionId: number | null
  organizationUnitId: number | null
  scopeKind: "institutional" | "personal" | "guest" | "platform"
  policyVersion: number
}

/**
 * Student Cora tenant follows enrollment → course.university_id.
 * Never the compatibility campus field on the enrollment row (Student 747).
 */
export async function resolveTrustedStudentCoraContext(input: {
  studentDbId: number
  requestedCourseId?: number | null
}): Promise<TrustedCoraContext | null> {
  const enrollment = await resolveStudentCourseContextByDbId(input.studentDbId)
  if (!enrollment) return null
  const requested = input.requestedCourseId ?? enrollment.courseId
  if (
    !studentMayAccessEnrolledCourse({
      enrolledCourseId: enrollment.courseId,
      requestedCourseId: requested,
    })
  ) {
    return null
  }
  const tenant = await resolveCourseTenant(requested)
  const institutionId = tenant?.institutionId ?? null
  return {
    actorType: "student",
    actorId: input.studentDbId,
    institutionId,
    courseId: requested,
    sessionId: enrollment.sessionId ?? null,
    organizationUnitId: tenant?.organizationUnitId ?? null,
    scopeKind: institutionId != null ? "institutional" : "personal",
    policyVersion: 1,
  }
}

export async function resolveTrustedFacultyCoraContext(input: {
  instructorId: number
  courseId: number
  isStaffed: boolean
}): Promise<TrustedCoraContext | null> {
  if (!facultyMayAccessCourseByRelationship({ hasCourseStaffOrOwnership: input.isStaffed })) {
    return null
  }
  const tenant = await resolveCourseTenant(input.courseId)
  return {
    actorType: "faculty",
    actorId: input.instructorId,
    institutionId: tenant?.institutionId ?? null,
    courseId: input.courseId,
    sessionId: null,
    organizationUnitId: tenant?.organizationUnitId ?? null,
    scopeKind: tenant?.institutionId != null ? "institutional" : "personal",
    policyVersion: 1,
  }
}

export function institutionIdForCoraCharge(trustedInstitutionId: number | null): number | null {
  return trustedInstitutionId != null && trustedInstitutionId >= 1 ? trustedInstitutionId : null
}
