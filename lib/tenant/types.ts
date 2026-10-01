export type TenantActorType = "student" | "faculty" | "institution" | "platform_admin"

/**
 * Server-derived tenant context. Never construct this from request parameters.
 * Institution equality is necessary, not sufficient — actor policy still applies.
 */
export type TenantContext = {
  actorType: TenantActorType
  actorId: number
  institutionId: number | null
  membershipId?: number
  courseId?: number
  sessionId?: number | null
  organizationUnitId?: number | null
  resourceType?: TenantResourceType
  resourceId?: number
}

export type TenantResourceType =
  | "course"
  | "session"
  | "quiz"
  | "attempt"
  | "organization_unit"
  | "student"

export type ResourceTenant = {
  institutionId: number | null
  courseId: number | null
  sessionId?: number | null
  organizationUnitId?: number | null
  resourceType: TenantResourceType
  resourceId: number
}

/** Policy-only predicates — no I/O. Used by Stage 4 tests and authorize helpers. */
export function studentMayAccessEnrolledCourse(args: {
  enrolledCourseId: number | null
  requestedCourseId: number
}): boolean {
  const enrolled = Math.trunc(Number(args.enrolledCourseId))
  const requested = Math.trunc(Number(args.requestedCourseId))
  if (!Number.isFinite(enrolled) || enrolled < 1) return false
  if (!Number.isFinite(requested) || requested < 1) return false
  return enrolled === requested
}

/** `students.university_id` is compatibility only — never authorization. */
export function studentTenantFollowsCourseNotLegacyUniversity(args: {
  studentsUniversityId: number | null
  courseUniversityId: number | null
}): number | null {
  const course = args.courseUniversityId != null ? Number(args.courseUniversityId) : null
  if (course != null && Number.isFinite(course) && course > 0) return Math.trunc(course)
  return null
}

export function facultyMayAccessCourseByRelationship(args: {
  hasCourseStaffOrOwnership: boolean
}): boolean {
  return args.hasCourseStaffOrOwnership === true
}

export function affiliationAloneDoesNotGrantCourseAccess(): false {
  return false
}
