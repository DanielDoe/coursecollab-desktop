import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildFacultyCoraSession } from "@/lib/cora/security"
import { resolveModuleCapabilities } from "@/lib/cora/capabilities/resolve-capabilities"
import {
  FACULTY_CORA_MODULE_REGISTRY,
  FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
  type FacultyCoraModuleId,
} from "@/lib/cora/capabilities/faculty-module-registry"

export const dynamic = "force-dynamic"

/**
 * GET /api/instructor/cora/capabilities
 * Faculty Cora capability boundary for the authenticated instructor + course.
 *
 * Cora clients should load this instead of hard-coding permissions.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { searchParams } = new URL(request.url)
    const modulesParam = searchParams.get("modules")
    const focusModules = modulesParam?.split(",").filter(Boolean) as
      | FacultyCoraModuleId[]
      | undefined
    const membershipTierOverride = searchParams.get("membershipTier")

    const session = await buildFacultyCoraSession({
      instructorId: scope.instructorId,
      courseId: scope.course.id,
      courseCode: scope.course.course_code ?? null,
      courseTitle: scope.course.course_title ?? null,
    })

    const resolved = resolveModuleCapabilities({
      session,
      membershipTier: membershipTierOverride ?? session.instructorMembershipTier,
      focusModules:
        focusModules && focusModules.length > 0
          ? focusModules
          : (Object.keys(FACULTY_CORA_MODULE_REGISTRY) as FacultyCoraModuleId[]),
    })

    return NextResponse.json({
      principle: FACULTY_CORA_AUTHORIZATION_PRINCIPLE,
      principal: {
        userId: session.userId,
        role: session.role,
        courseIds: session.courseIds,
        courseId: scope.course.id,
        courseCode: scope.course.course_code ?? null,
        courseTitle: scope.course.course_title ?? null,
        membershipTier: resolved.membershipTier,
      },
      modules: resolved.modules,
      capabilityIds: resolved.capabilityIds,
      lockedModules: resolved.lockedModules,
      packet: resolved.packet,
      registryVersion: 1,
      moduleCount: Object.keys(FACULTY_CORA_MODULE_REGISTRY).length,
    })
  } catch (error) {
    console.error("[instructor/cora/capabilities]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load capabilities" },
      { status: 500 },
    )
  }
}
