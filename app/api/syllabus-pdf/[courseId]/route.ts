import { type NextRequest, NextResponse } from "next/server"
import { getActorCoursePermissionCodes } from "@/lib/course-permission-guard"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import {
  buildSyllabusPdfProxyUrl,
  fetchSyllabusPdfBytes,
  getSyllabusPdfRecord,
  syllabusPdfDownloadName,
} from "@/lib/syllabus/syllabus-pdf"

export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ courseId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { courseId: courseIdRaw } = await context.params
    const courseId = Number(courseIdRaw)
    if (!Number.isFinite(courseId)) {
      return NextResponse.json({ error: "Invalid course ID" }, { status: 400 })
    }

    const record = await getSyllabusPdfRecord(courseId)
    if (!record?.pdfUrl) {
      return NextResponse.json({ error: "Syllabus PDF not found" }, { status: 404 })
    }

    const rosterId = request.nextUrl.searchParams.get("studentId")?.trim()
    let authorized = false

    if (rosterId) {
      const studentDbId = await resolveStudentDatabaseIdFromParam(rosterId)
      if (studentDbId != null) {
        const ctx = await resolveStudentCourseContextByDbId(studentDbId)
        authorized =
          ctx?.courseId === courseId &&
          record.status === "published" &&
          record.contentMode === "pdf"
      }
    } else {
      const scope = await tryResolveInstructorCourseScope(request)
      if (scope.ok && scope.course.id === courseId) {
        const permCtx = await getActorCoursePermissionCodes(request)
        if (permCtx.ok) {
          authorized =
            permCtx.isInstructorOwner ||
            permCtx.permissions.some((p) =>
              ["manage_syllabus", "manage_course_settings", "view_course_content"].includes(p),
            )
        }
      } else if (!scope.ok && scope.reason === "invalid") {
        return scope.response
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buffer = await fetchSyllabusPdfBytes(record.pdfUrl)
    const etag = `"syl-${courseId}-${record.updatedAt ?? record.pdfUrl.length}"`
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } })
    }

    const asDownload = request.nextUrl.searchParams.get("download") === "1"
    const filename = record.pdfFileName || syllabusPdfDownloadName(record.title)

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
        ETag: etag,
        "Content-Disposition": asDownload
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[syllabus-pdf]", error)
    return NextResponse.json({ error: "Failed to load syllabus PDF" }, { status: 500 })
  }
}
