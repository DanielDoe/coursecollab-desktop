import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildLectureInstructorCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import { ensureLectureWorkspaceSchema } from "@/lib/ensure-lecture-workspace-schema"
import {
  parseLectureWorkspace,
  serializeLectureWorkspaceForStorage,
  type LectureWorkspaceConfig,
} from "@/lib/lecture-workspace"

export const dynamic = "force-dynamic"

async function loadLectureWorkspaceRaw(
  lectureId: number,
  courseId: number,
  instructorId: number,
  courseCode: string,
): Promise<unknown | undefined> {
  await ensureLectureWorkspaceSchema()
  const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    courseCode,
  )
  const rows = await sql`
    SELECT l.lecture_workspace
    FROM lectures l
    WHERE l.id = ${lectureId}
      AND l.deleted_at IS NULL
      AND (${scopeWhere})
    LIMIT 1
  `
  if (rows.length === 0) return undefined
  return rows[0]?.lecture_workspace ?? null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const raw = await loadLectureWorkspaceRaw(
      lectureId,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (raw === undefined) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    const config = parseLectureWorkspace(raw)
    return NextResponse.json({
      config,
      configured: raw != null && raw !== "",
    })
  } catch (error) {
    console.error("[Instructor lecture workspace GET]", error)
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const body = (await request.json()) as { config?: LectureWorkspaceConfig }
    if (!body.config || typeof body.config !== "object") {
      return NextResponse.json({ error: "config is required" }, { status: 400 })
    }

    const normalized = serializeLectureWorkspaceForStorage(body.config)
    await ensureLectureWorkspaceSchema()
    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )

    const result = await sql`
      UPDATE lectures l
      SET lecture_workspace = ${JSON.stringify(normalized)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE l.id = ${lectureId}
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      RETURNING l.id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ config: normalized, message: "Workspace saved" })
  } catch (error) {
    console.error("[Instructor lecture workspace PATCH]", error)
    return NextResponse.json({ error: "Failed to save workspace" }, { status: 500 })
  }
}
