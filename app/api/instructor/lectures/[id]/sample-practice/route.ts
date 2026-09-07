import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { buildLectureInstructorCourseScopeSqlFragment } from "@/lib/instructor-default-courses"
import {
  parseLectureSamplePractice,
  serializeSamplePracticeForStorage,
  type LectureSamplePracticeConfig,
} from "@/lib/lecture-sample-practice"

export const dynamic = "force-dynamic"

async function loadLectureSamplePracticeRaw(
  lectureId: number,
  courseId: number,
  instructorId: number,
  courseCode: string,
): Promise<unknown | undefined> {
  const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    courseCode,
  )
  const rows = await sql`
    SELECT l.sample_practice
    FROM lectures l
    WHERE l.id = ${lectureId}
      AND l.deleted_at IS NULL
      AND (${scopeWhere})
    LIMIT 1
  `
  if (rows.length === 0) return undefined
  return rows[0]?.sample_practice ?? null
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

    const raw = await loadLectureSamplePracticeRaw(
      lectureId,
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )
    if (raw === undefined) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    const config = parseLectureSamplePractice(raw)
    return NextResponse.json({
      config,
      configured: raw != null && raw !== "",
    })
  } catch (error) {
    console.error("[Instructor lecture sample practice GET]", error)
    return NextResponse.json({ error: "Failed to load sample practice" }, { status: 500 })
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

    const body = (await request.json()) as { config?: LectureSamplePracticeConfig }
    if (!body.config || typeof body.config !== "object") {
      return NextResponse.json({ error: "config is required" }, { status: 400 })
    }

    const normalized = serializeSamplePracticeForStorage(body.config)
    const scopeWhere = await buildLectureInstructorCourseScopeSqlFragment(
      scope.course.id,
      scope.instructorId,
      scope.course.course_code,
    )

    const result = await sql`
      UPDATE lectures l
      SET sample_practice = ${JSON.stringify(normalized)}::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE l.id = ${lectureId}
        AND l.deleted_at IS NULL
        AND (${scopeWhere})
      RETURNING l.id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ config: normalized, message: "Sample practice saved" })
  } catch (error) {
    console.error("[Instructor lecture sample practice PATCH]", error)
    return NextResponse.json({ error: "Failed to save sample practice" }, { status: 500 })
  }
}
