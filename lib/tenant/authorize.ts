import { type NextRequest, NextResponse } from "next/server"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { requireInstructorOrTaCourse } from "@/lib/instructor-actor-scope"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireAdminId } from "@/lib/admin-api-auth"
import {
  canAccessInstitutionCourse,
  canAccessOrganizationUnit,
  requireInstitutionPermission,
  type InstitutionAdminScope,
} from "@/lib/institutions/rbac"
import type { InstitutionSession } from "@/lib/institutions/auth"
import type { InstitutionPermission } from "@/lib/institutions/permissions"
import { sameInstitutionIds } from "@/lib/institutions/tenant-integrity"
import {
  studentMayAccessEnrolledCourse,
  type TenantContext,
} from "@/lib/tenant/types"
import { resolveRequestedResourceTenant } from "@/lib/tenant/resource"
import { logTenantAuthorizationFailure } from "@/lib/tenant/log"

function deny(message = "Not authorized") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function studentIsEnrolledInCourse(
  studentDbId: number,
  courseId: number,
): Promise<boolean> {
  const ctx = await resolveStudentCourseContextByDbId(studentDbId)
  if (!ctx) return false
  return studentMayAccessEnrolledCourse({
    enrolledCourseId: ctx.courseId,
    requestedCourseId: courseId,
  })
}

/**
 * Student session + enrollment + resource → course → university.
 * Institution membership and students.university_id are not authorization.
 */
export async function requireStudentTenantAccess(
  request: NextRequest,
  resource?: {
    courseId?: number | null
    sessionId?: number | null
    quizId?: number | null
    attemptId?: number | null
    claimedStudentId?: string | null
  },
): Promise<{ ok: true; context: TenantContext } | { ok: false; response: NextResponse }> {
  const bound = await requireBoundStudentCaller(request, resource?.claimedStudentId)
  if (!bound.ok) return bound

  const enrollment = await resolveStudentCourseContextByDbId(bound.studentDbId)
  if (!enrollment) {
    await logTenantAuthorizationFailure(request, {
      actorType: "student",
      actorId: bound.studentDbId,
      reason: "no_enrollment",
    })
    return { ok: false, response: deny() }
  }

  const hasExplicitResource =
    resource?.quizId != null ||
    resource?.attemptId != null ||
    resource?.sessionId != null ||
    resource?.courseId != null
  const requested = await resolveRequestedResourceTenant({
    courseId: resource?.courseId ?? (hasExplicitResource ? null : enrollment.courseId),
    sessionId: resource?.sessionId,
    quizId: resource?.quizId,
    attemptId: resource?.attemptId,
  })
  if (hasExplicitResource && !requested) {
    await logTenantAuthorizationFailure(request, {
      actorType: "student",
      actorId: bound.studentDbId,
      resourceType: resource?.quizId != null ? "quiz" : resource?.attemptId != null ? "attempt" : "course",
      resourceId: resource?.quizId ?? resource?.attemptId ?? resource?.sessionId ?? resource?.courseId,
      reason: "resource_unresolved",
    })
    return { ok: false, response: deny() }
  }
  const requestedCourseId = requested?.courseId ?? enrollment.courseId
  if (
    !studentMayAccessEnrolledCourse({
      enrolledCourseId: enrollment.courseId,
      requestedCourseId,
    })
  ) {
    await logTenantAuthorizationFailure(request, {
      actorType: "student",
      actorId: bound.studentDbId,
      resourceType: requested?.resourceType ?? "course",
      resourceId: requestedCourseId,
      resolvedInstitutionId: requested?.institutionId ?? null,
      reason: "not_enrolled",
    })
    return { ok: false, response: deny() }
  }

  return {
    ok: true,
    context: {
      actorType: "student",
      actorId: bound.studentDbId,
      institutionId: requested?.institutionId ?? null,
      courseId: requestedCourseId,
      sessionId: enrollment.sessionId,
      organizationUnitId: requested?.organizationUnitId ?? null,
      resourceType: requested?.resourceType,
      resourceId: requested?.resourceId,
    },
  }
}

/**
 * Faculty session + course_staff/ownership + course.university_id.
 * Institution membership alone is not enough.
 */
export async function requireFacultyTenantAccess(
  request: NextRequest,
  opts?: { allowTa?: boolean; courseId?: number | null },
): Promise<{ ok: true; context: TenantContext } | { ok: false; response: NextResponse }> {
  const scope = opts?.allowTa === false
    ? await requireInstructorCourse(request)
    : await requireInstructorOrTaCourse(request)
  if (!scope.ok) return scope

  const courseId = scope.course.id
  const resolvedActorId = "instructorId" in scope ? scope.instructorId : scope.actorId

  if (opts?.courseId != null && Number(opts.courseId) !== Number(courseId)) {
    await logTenantAuthorizationFailure(request, {
      actorType: "faculty",
      actorId: resolvedActorId,
      resourceType: "course",
      resourceId: opts.courseId,
      reason: "course_mismatch",
    })
    return { ok: false, response: deny() }
  }

  const owned = await resolveRequestedResourceTenant({ courseId })
  return {
    ok: true,
    context: {
      actorType: "faculty",
      actorId: resolvedActorId,
      institutionId: owned?.institutionId ?? null,
      courseId,
      organizationUnitId: owned?.organizationUnitId ?? null,
      resourceType: "course",
      resourceId: courseId,
    },
  }
}

/**
 * Institution session + permission + optional course/unit tenant proof.
 * Reuses Stage 3 RBAC. Does not treat affiliation as administration.
 */
export async function requireInstitutionTenantAccess(
  request: NextRequest,
  permission: InstitutionPermission,
  resource?: { courseId?: number | null; organizationUnitId?: number | null },
): Promise<
  | { ok: true; context: TenantContext; session: InstitutionSession; scope: InstitutionAdminScope }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireInstitutionPermission(request, permission)
  if (!auth.ok) return auth

  if (resource?.courseId != null) {
    const allowed = await canAccessInstitutionCourse(auth.session, resource.courseId)
    if (!allowed) {
      await logTenantAuthorizationFailure(request, {
        actorType: "institution",
        actorId: auth.session.userId,
        resourceType: "course",
        resourceId: resource.courseId,
        activeInstitutionId: auth.session.institutionId,
        reason: "course_out_of_scope",
      })
      return { ok: false, response: deny() }
    }
  }
  if (resource?.organizationUnitId != null) {
    const allowed = await canAccessOrganizationUnit(auth.session, resource.organizationUnitId)
    if (!allowed) {
      await logTenantAuthorizationFailure(request, {
        actorType: "institution",
        actorId: auth.session.userId,
        resourceType: "organization_unit",
        resourceId: resource.organizationUnitId,
        activeInstitutionId: auth.session.institutionId,
        reason: "unit_out_of_scope",
      })
      return { ok: false, response: deny() }
    }
  }

  return {
    ok: true,
    session: auth.session,
    scope: auth.scope,
    context: {
      actorType: "institution",
      actorId: auth.session.userId,
      institutionId: auth.session.institutionId,
      membershipId: auth.session.memberId,
      courseId: resource?.courseId ?? undefined,
      organizationUnitId: resource?.organizationUnitId ?? auth.session.organizationUnitId,
    },
  }
}

/** Platform administration is a separate security domain (Stage 6 privileged audit). */
export async function requirePlatformAdminAccess(
  request: NextRequest,
): Promise<{ ok: true; context: TenantContext } | { ok: false; response: NextResponse }> {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin
  return {
    ok: true,
    context: {
      actorType: "platform_admin",
      actorId: Number(admin.adminId),
      institutionId: null,
    },
  }
}

export function tenantInstitutionsMatch(
  actorInstitutionId: number | null | undefined,
  resourceInstitutionId: number | null | undefined,
): boolean {
  return sameInstitutionIds(actorInstitutionId, resourceInstitutionId)
}
