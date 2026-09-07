import { type NextRequest, NextResponse } from "next/server"
import { fetchLecturePdfBytes, getLecturePdfRecord } from "@/lib/lecture-pdf-fetch"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { isLectureInSelectedCourseScope } from "@/lib/instructor-lecture-slide-scope"
import { lecturePdfDownloadName } from "@/lib/resolve-lecture-pdf-url"

export const dynamic = "force-dynamic"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> },
) {
  try {
    const { lectureId: idRaw } = await params
    const lectureId = Number.parseInt(idRaw, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const record = await getLecturePdfRecord(lectureId)
    if (!record) {
      return NextResponse.json({ error: "PDF not found" }, { status: 404 })
    }

    const rosterId = request.nextUrl.searchParams.get("studentId")?.trim()
    let authorized = false

    if (rosterId) {
      authorized = await isLectureAccessibleToStudent(rosterId, lectureId)
    } else {
      const scope = await tryResolveInstructorCourseScope(request)
      if (scope.ok) {
        authorized = await isLectureInSelectedCourseScope(
          lectureId,
          scope.course.id,
          scope.instructorId,
          scope.course.course_code,
        )
      } else if (!scope.ok && scope.reason === "invalid") {
        return scope.response
      }
    }

    if (!authorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buffer = await fetchLecturePdfBytes(record.pdfUrl, {
      lectureId,
      requestOrigin: request.nextUrl.origin,
    })
    const etag = `"lec-${lectureId}-${record.updatedAt ?? record.pdfUrl.length}"`
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } })
    }

    const asDownload = request.nextUrl.searchParams.get("download") === "1"
    const filename = lecturePdfDownloadName(record.title ?? undefined)

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
  } catch (error: unknown) {
    console.error("[pdf-proxy]", error)
    return NextResponse.json({ error: "Failed to load PDF" }, { status: 500 })
  }
}
