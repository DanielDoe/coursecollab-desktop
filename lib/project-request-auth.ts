import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  instructorCanAccessGroup,
  requireInstructorGroupAccess,
  requireGroupReadAccess,
} from "@/lib/group-request-auth"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { requireBoundStudentCaller, requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveGroupProjectCourseScope } from "@/lib/student-course-scope"

export type ProjectGroupRow = {
  id: number
  group_id: number
  status: string
  created_by: number
  course_id: number | null
  session: string | null
}

export async function loadProjectWithGroup(projectId: number): Promise<ProjectGroupRow | null> {
  const id = Math.trunc(Number(projectId))
  if (!Number.isFinite(id) || id < 1) return null
  const rows = await sql`
    SELECT
      p.id,
      p.group_id,
      p.status,
      g.created_by,
      g.course_id,
      g.session
    FROM projects p
    JOIN groups g ON p.group_id = g.id
    WHERE p.id = ${id}
    LIMIT 1
  `
  return (rows[0] as ProjectGroupRow | undefined) ?? null
}

export async function requireProjectsListScope(request: NextRequest) {
  return resolveGroupProjectCourseScope(request)
}

/** Instructor (or admin) must own the project's course — used for approve/reject. */
export async function requireInstructorProjectAccess(
  request: NextRequest,
  projectId: number,
): Promise<
  | { ok: true; project: ProjectGroupRow; instructorId: number }
  | { ok: false; response: NextResponse }
> {
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope
  const project = await loadProjectWithGroup(projectId)
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  }
  const allowed = await instructorCanAccessGroup(scope.instructorId, project)
  if (!allowed) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }
  return { ok: true, project, instructorId: scope.instructorId }
}

export async function requireProjectReadAccess(
  request: NextRequest,
  projectId: number,
): Promise<{ ok: true; project: ProjectGroupRow } | { ok: false; response: NextResponse }> {
  const project = await loadProjectWithGroup(projectId)
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  }
  const access = await requireGroupReadAccess(request, project)
  if (!access.ok) return access
  return { ok: true, project }
}

function unauthenticatedProjectActorResponse() {
  return NextResponse.json({ error: "Student or instructor authentication required" }, { status: 401 })
}

/** Instructor of the course, or the authenticated group leader. */
export async function requireProjectLeaderOrInstructor(
  request: NextRequest,
  projectId: number,
): Promise<
  | { ok: true; project: ProjectGroupRow; role: "admin" | "instructor" | "student"; studentDbId?: number }
  | { ok: false; response: NextResponse }
> {
  const project = await loadProjectWithGroup(projectId)
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  }

  const studentHeader = request.headers.get("x-student-id")?.trim()
  if (studentHeader) {
    const bound = await requireBoundStudentCaller(request, studentHeader)
    if (!bound.ok) return bound
    if (Number(project.created_by) !== bound.studentDbId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Only the group leader can edit the project" }, { status: 403 }),
      }
    }
    return { ok: true, project, role: "student", studentDbId: bound.studentDbId }
  }

  const instructorHeader = request.headers.get("x-instructor-id")?.trim()
  if (instructorHeader) {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session
    const allowed = await instructorCanAccessGroup(session.instructorId, project)
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "instructor" }
  }

  const studentSession = await requireCallerStudentDbId(request)
  if (studentSession.ok) {
    if (Number(project.created_by) !== studentSession.studentDbId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Only the group leader can edit the project" }, { status: 403 }),
      }
    }
    return { ok: true, project, role: "student", studentDbId: studentSession.studentDbId }
  }

  const instructorSession = await requireInstructorSession(request)
  if (instructorSession.ok) {
    const allowed = await instructorCanAccessGroup(instructorSession.instructorId, project)
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "instructor" }
  }

  return { ok: false, response: unauthenticatedProjectActorResponse() }
}

/** Instructor of the course, or any authenticated member of the project group. */
export async function requireProjectMemberOrInstructor(
  request: NextRequest,
  projectId: number,
): Promise<
  | { ok: true; project: ProjectGroupRow; role: "admin" | "instructor" | "student"; studentDbId?: number }
  | { ok: false; response: NextResponse }
> {
  const project = await loadProjectWithGroup(projectId)
  if (!project) {
    return { ok: false, response: NextResponse.json({ error: "Project not found" }, { status: 404 }) }
  }

  const studentHeader = request.headers.get("x-student-id")?.trim()
  if (studentHeader) {
    const bound = await requireBoundStudentCaller(request, studentHeader)
    if (!bound.ok) return bound
    if (Number(project.created_by) === bound.studentDbId) {
      return { ok: true, project, role: "student", studentDbId: bound.studentDbId }
    }
    const member = await sql`
      SELECT 1 FROM group_members
      WHERE group_id = ${project.group_id} AND student_id = ${bound.studentDbId}
      LIMIT 1
    `
    if (member.length === 0) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "student", studentDbId: bound.studentDbId }
  }

  const instructorHeader = request.headers.get("x-instructor-id")?.trim()
  if (instructorHeader) {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session
    const allowed = await instructorCanAccessGroup(session.instructorId, project)
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "instructor" }
  }

  const studentSession = await requireCallerStudentDbId(request)
  if (studentSession.ok) {
    if (Number(project.created_by) === studentSession.studentDbId) {
      return { ok: true, project, role: "student", studentDbId: studentSession.studentDbId }
    }
    const member = await sql`
      SELECT 1 FROM group_members
      WHERE group_id = ${project.group_id} AND student_id = ${studentSession.studentDbId}
      LIMIT 1
    `
    if (member.length === 0) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "student", studentDbId: studentSession.studentDbId }
  }

  const instructorSession = await requireInstructorSession(request)
  if (instructorSession.ok) {
    const allowed = await instructorCanAccessGroup(instructorSession.instructorId, project)
    if (!allowed) {
      return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
    }
    return { ok: true, project, role: "instructor" }
  }

  return { ok: false, response: unauthenticatedProjectActorResponse() }
}

export async function requireInstructorGroupForCreate(
  request: NextRequest,
  group: { course_id?: unknown; session?: unknown; created_by?: unknown },
) {
  return requireInstructorGroupAccess(request, group)
}

export { studentDbIdFromGroupsRequest, instructorIdFromGroupsRequest } from "@/lib/group-request-auth"
