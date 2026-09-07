import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { mergeCourseModuleSettings } from "@/lib/course-module-settings"
import {
  bootstrapInstructorCoursesAndLinks,
  shouldAutoSeedInstructorCourses,
} from "@/lib/instructor-default-courses"
import { courseOwnerIdForActor, loadInstructorActor } from "@/lib/instructor-actor-scope"
import { normalizeCourseStaffRole } from "@/lib/roles"
import { formatAcademicTermLabel, getActiveAcademicTerm } from "@/lib/active-academic-term"
import {
  listFacultyCourseOfferings,
} from "@/lib/faculty-course-offerings"
import { offeringsToLegacyCourses } from "@/lib/faculty-course-offerings-shared"
import { createInstructorCourse } from "@/lib/create-instructor-course"
import { assertInstructorOwnsCourse, requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"
import { purgeOwnedCourse } from "@/lib/purge-owned-course"
import {
  courseRowMatchesUniversity,
  parseUniversityIdFromRequest,
} from "@/lib/instructor-university-scope"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const actorId = Number(instructorId)
    const actor = await loadInstructorActor(actorId)
    if (!actor || !actor.is_active) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ownerId = courseOwnerIdForActor(actor)
    const universityId = parseUniversityIdFromRequest(request)

    if (shouldAutoSeedInstructorCourses() && actor.role !== "ta") {
      await bootstrapInstructorCoursesAndLinks(actorId)
    }

    let rows = await sql`
      SELECT
        c.id,
        c.course_code,
        c.course_title,
        c.university,
        c.university_id,
        c.semester,
        c.instructor_id,
        c.description,
        c.is_active,
        c.module_settings,
        c.created_at,
        c.updated_at,
        COALESCE(cs.role, 'INSTRUCTOR') AS staff_role
      FROM course_staff cs
      INNER JOIN courses c ON c.id = cs.course_id
      WHERE cs.instructor_id = ${actorId}
        AND cs.is_active = true
        AND c.is_active = true
      ORDER BY c.course_title ASC, c.id ASC
    `

    if (rows.length === 0 && actor.role !== "ta") {
      rows = await sql`
        SELECT id, course_code, course_title, university, university_id, semester, instructor_id, description,
               is_active, module_settings, created_at, updated_at, 'INSTRUCTOR' AS staff_role
        FROM courses
        WHERE instructor_id = ${ownerId} AND is_active = true
        ORDER BY course_title ASC, id ASC
      `
    }

    if (universityId != null) {
      rows = (rows as Record<string, unknown>[]).filter((r) =>
        courseRowMatchesUniversity(
          {
            university_id: r.university_id as number | null,
            course_code: r.course_code as string,
            university: r.university as string | null,
          },
          universityId,
        ),
      )
    }

    const legacyRows = rows.map((r: Record<string, unknown>) => {
      const rawRole = String(r.staff_role ?? "INSTRUCTOR")
      return {
        ...r,
        module_settings: mergeCourseModuleSettings(r.module_settings),
        staff_role: normalizeCourseStaffRole(rawRole) ?? rawRole,
      }
    })

    let offerings = await listFacultyCourseOfferings(actorId, universityId)
    const activeTerm = await getActiveAcademicTerm()
    const activeTermPayload = activeTerm
      ? { id: activeTerm.id, label: formatAcademicTermLabel(activeTerm.year, activeTerm.term) }
      : null

    const courses =
      offerings.length > 0 ? offeringsToLegacyCourses(offerings) : legacyRows

    return NextResponse.json({
      courses,
      offerings,
      activeTerm: activeTermPayload,
      actorRole: actor.role,
      courseOwnerId: ownerId,
    })
  } catch (error) {
    console.error("[instructor/courses]", error)
    return NextResponse.json({ error: "Failed to load courses" }, { status: 500 })
  }
}

/** Create a course owned by the signed-in faculty member. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { course_code, course_title, description, university, academic_term_id } = body

    if (!course_code?.trim() || !course_title?.trim()) {
      return NextResponse.json({ error: "course_code and course_title are required" }, { status: 400 })
    }

    const course = await createInstructorCourse({
      instructorId: auth.instructorId,
      courseCode: String(course_code),
      courseTitle: String(course_title),
      description: description ?? null,
      university: university ?? null,
      academicTermId:
        academic_term_id != null && Number.isFinite(Number(academic_term_id))
          ? Number(academic_term_id)
          : null,
    })

    return NextResponse.json({ course }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create course"
    const status = message.includes("already have") ? 409 : 400
    console.error("[instructor/courses POST]", error)
    return NextResponse.json({ error: message }, { status })
  }
}

/** Soft-delete a course the signed-in faculty member owns. */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const courseId = Number(body?.courseId ?? request.nextUrl.searchParams.get("courseId"))
    if (!Number.isFinite(courseId) || courseId < 1) {
      return NextResponse.json({ error: "courseId is required" }, { status: 400 })
    }

    const scopedCourseId = Number(request.headers.get("x-course-id"))
    if (Number.isFinite(scopedCourseId) && scopedCourseId === courseId) {
      return NextResponse.json(
        {
          error: "This course is currently selected in your dashboard. Switch to another course, then delete.",
          code: "course_selected",
        },
        { status: 409 },
      )
    }

    const owns = await assertInstructorOwnsCourse(auth.instructorId, courseId)
    if (!owns) {
      return NextResponse.json({ error: "You can only delete courses you own" }, { status: 403 })
    }

    await purgeOwnedCourse(courseId)

    return NextResponse.json({ ok: true, courseId, purged: true })
  } catch (error) {
    console.error("[instructor/courses DELETE]", error)
    return NextResponse.json({ error: "Failed to delete course" }, { status: 500 })
  }
}
