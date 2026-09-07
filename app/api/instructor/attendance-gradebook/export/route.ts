import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import {
  loadAttendanceGradebookRowsRaw,
  mapAttendanceGradebookRow,
  mergeAttendanceGradebookRow,
  type AttendanceGradebookExportRow,
} from "@/lib/attendance-gradebook-rows-query"
import { resolveAttendanceInstructorScope } from "@/lib/attendance-instructor-scope"
import { exportAttendanceGradebookToPDF } from "@/lib/pdf-export"
import { resolvePdfArchiveMeta } from "@/lib/pdf-export-archive-meta"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

async function listInstructorSectionCodes(instructorId: number, courseId: number | null): Promise<string[]> {
  if (courseId != null) {
    const r = await sql`
      SELECT DISTINCT TRIM(s.code) AS code
      FROM sessions s
      WHERE s.course_id = ${courseId} AND TRIM(s.code) <> ''
      ORDER BY code
    `
    return (r as { code: string }[]).map((x) => String(x.code ?? "").trim()).filter(Boolean)
  }
  const r = await sql`
    SELECT DISTINCT TRIM(s.code) AS code
    FROM sessions s
    INNER JOIN courses c ON c.id = s.course_id
    WHERE c.instructor_id = ${instructorId} AND c.is_active = true AND TRIM(s.code) <> ''
    ORDER BY code
  `
  return (r as { code: string }[]).map((x) => String(x.code ?? "").trim()).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const instructorIdRaw = request.headers.get("x-instructor-id")?.trim()
    const instructorId = instructorIdRaw ? parseInt(instructorIdRaw, 10) : NaN
    if (!instructorIdRaw || Number.isNaN(instructorId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response
    if (scoped.courseId != null && String(scoped.instructorId ?? "") !== String(instructorId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const rawSection = request.nextUrl.searchParams.get("section")?.trim() ?? ""
    const allSections = rawSection === "" || rawSection.toLowerCase() === "all"

    const codes = allSections
      ? await listInstructorSectionCodes(instructorId, scoped.courseId)
      : [rawSection]

    if (codes.length === 0) {
      const archiveMeta = await resolvePdfArchiveMeta(request, "all", "attendance-gradebook")
      const pdf = exportAttendanceGradebookToPDF([], {
        title: "Attendance — Gradebook %",
        subtitle: "All sections · student_grades.attendance_score",
        coverLines: archiveMeta.coverLines,
        primaryColor: [139, 92, 246],
        includeTimestamp: true,
        includePageNumbers: true,
        sectionScopeLabel: "All sections",
        showSectionColumn: true,
      })
      const pdfBlob = pdf.output("blob")
      const buffer = Buffer.from(await pdfBlob.arrayBuffer())
      const safeName = `${archiveMeta.filenameStem}.pdf`.replace(/[^\w.\-()+]+/g, "-")
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeName}"`,
          "Content-Length": buffer.length.toString(),
        },
      })
    }

    const scope = await resolveAttendanceInstructorScope(request)

    const merged = new Map<number, AttendanceGradebookExportRow>()
    for (const code of codes) {
      const raw = await loadAttendanceGradebookRowsRaw({
        instructorId,
        sectionRaw: code,
        courseId: scoped.courseId,
        academicTermId: scope.academicTermId,
        sessionId: scope.sessionId,
      })
      if (raw === null) {
        return NextResponse.json({ error: "You do not teach one or more sections" }, { status: 403 })
      }
      for (const row of raw) {
        const mapped = mapAttendanceGradebookRow(row)
        merged.set(mapped.studentId, mergeAttendanceGradebookRow(merged.get(mapped.studentId), mapped))
      }
    }

    const rows = Array.from(merged.values()).sort((a, b) =>
      a.studentName.localeCompare(b.studentName, undefined, { sensitivity: "base" }),
    )

    const sessionForMeta = allSections ? "all" : rawSection
    const scopeLabel = allSections ? "All sections" : `Section ${rawSection}`
    const archiveMeta = await resolvePdfArchiveMeta(request, sessionForMeta, "attendance-gradebook")

    const pdf = exportAttendanceGradebookToPDF(rows, {
      title: "Attendance — Gradebook %",
      subtitle: `${scopeLabel} · student_grades.attendance_score`,
      coverLines: archiveMeta.coverLines,
      primaryColor: [139, 92, 246],
      includeTimestamp: true,
      includePageNumbers: true,
      sectionScopeLabel: scopeLabel,
      showSectionColumn: allSections,
    })

    const pdfBlob = pdf.output("blob")
    const buffer = Buffer.from(await pdfBlob.arrayBuffer())
    const safeName = `${archiveMeta.filenameStem}.pdf`.replace(/[^\w.\-()+]+/g, "-")

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  } catch (e: unknown) {
    console.error("[attendance-gradebook/export]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Export failed" },
      { status: 500 },
    )
  }
}
