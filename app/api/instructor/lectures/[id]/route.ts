import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { replaceLectureSessionAccessFromRecord } from "@/lib/lecture-session-access-sync"
import { softDeleteInstructorOwnedLecture } from "@/lib/instructor-lecture-delete"

export const dynamic = "force-dynamic"

function sessionColValue(session_access: unknown): string | null {
  if (session_access === null) return null
  return JSON.stringify(session_access)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }
    const courseId = scope.course.id

    const body = await request.json()
    const {
      week,
      title,
      session,
      description,
      materials_url,
      session_access,
      is_active,
      is_published,
      allow_download,
      objectives,
      learning_objectives,
    } = body
    const resolved = await params
    const lectureId = Number.parseInt(resolved.id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const published =
      typeof is_active === "boolean"
        ? is_active
        : typeof is_published === "boolean"
          ? is_published
          : undefined

    const allowDownload =
      typeof allow_download === "boolean" ? allow_download : undefined

    const hasSa = session_access !== undefined

    let result
    if (hasSa && published !== undefined && allowDownload !== undefined) {
      const scol = sessionColValue(session_access)
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          session_access = ${scol},
          is_published = ${published},
          allow_download = ${allowDownload},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (hasSa && published !== undefined) {
      const scol = sessionColValue(session_access)
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          session_access = ${scol},
          is_published = ${published},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (hasSa && allowDownload !== undefined) {
      const scol = sessionColValue(session_access)
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          session_access = ${scol},
          allow_download = ${allowDownload},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (hasSa) {
      const scol = sessionColValue(session_access)
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          session_access = ${scol},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (published !== undefined && allowDownload !== undefined) {
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          is_published = ${published},
          allow_download = ${allowDownload},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (published !== undefined) {
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          is_published = ${published},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else if (allowDownload !== undefined) {
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          allow_download = ${allowDownload},
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    } else {
      result = await sql`
        UPDATE lectures
        SET
          week = COALESCE(${week ?? null}, week),
          title = COALESCE(${title ?? null}, title),
          session = COALESCE(${session ?? null}, session),
          description = COALESCE(${description ?? null}, description),
          materials_url = COALESCE(${materials_url ?? null}, materials_url),
          course_id = ${courseId},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
        RETURNING *
      `
    }

    if (result.length === 0) {
      return NextResponse.json({ error: "Lecture not found" }, { status: 404 })
    }

    if (hasSa) {
      await replaceLectureSessionAccessFromRecord(sql, lectureId, session_access)
    }

    const objectiveList = Array.isArray(learning_objectives)
      ? learning_objectives
      : Array.isArray(objectives)
        ? objectives
        : null
    if (objectiveList) {
      await sql`
        UPDATE lectures
        SET learning_objectives = ${JSON.stringify(objectiveList)}::jsonb, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${lectureId}
          AND (course_id = ${courseId} OR course_id IS NULL)
      `
    }

    return NextResponse.json({ lecture: result[0] })
  } catch (error) {
    console.error("Failed to update lecture:", error)
    return NextResponse.json({ error: "Failed to update lecture" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const lectureId = Number.parseInt((await params).id, 10)
    const result = await softDeleteInstructorOwnedLecture(request, lectureId)
    if (!result.ok) return result.response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Failed to delete lecture:", error)
    return NextResponse.json({ error: "Failed to delete lecture" }, { status: 500 })
  }
}
