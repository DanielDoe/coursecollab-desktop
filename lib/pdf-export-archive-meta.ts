/**
 * Server-only: course / section / academic term lines for PDF exports + safe filename stems.
 */
import { sql } from "@/lib/db"
import type { NextRequest } from "next/server"
import { tryResolveInstructorCourseScope } from "@/lib/instructor-course-scope"
import { sanitizeFilenameSegment } from "@/lib/results-pdf-filename"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export type PdfArchiveMeta = {
  coverLines: string[]
  /** ASCII-safe basename without .pdf */
  filenameStem: string
}

export type PdfArchiveReportKind =
  | "projects"
  | "groups-projects"
  | "trade-center-analytics"
  | "trade-center-trade-log"
  | "trade-center-rollovers"
  | "trade-center-donations"
  | "attendance-gradebook"

export async function resolvePdfArchiveMeta(
  request: NextRequest,
  sessionCode: string | null | undefined,
  reportKind: PdfArchiveReportKind,
): Promise<PdfArchiveMeta> {
  const session = sessionCode?.trim() || null
  const scope = await tryResolveInstructorCourseScope(request)

  const coverLines: string[] = []
  let courseCode = ""
  let semesterSlug = "term-unknown"
  let addedSemesterLine = false

  if (scope.ok) {
    const cc = String(scope.course.course_code ?? "").trim()
    const ct = String(scope.course.course_title ?? "").trim()
    courseCode = cc
    if (cc || ct) {
      coverLines.push(ct ? `${cc} — ${ct}` : cc)
    }
  }

  if (session && session !== "all") {
    const variants = normalizedSectionVariantsForSql(session)
    let rows: {
      code?: string
      description?: string | null
      term?: string | null
      year?: number | null
    }[] = []
    if (scope.ok) {
      rows = await sql`
        SELECT s.code, s.description, at.term, at.year
        FROM sessions s
        LEFT JOIN academic_terms at ON at.id = s.academic_term_id
        WHERE s.course_id = ${scope.course.id}
          AND TRIM(s.code) = ANY(${variants}::text[])
        LIMIT 1
      `
    } else {
      rows = await sql`
        SELECT s.code, s.description, at.term, at.year
        FROM sessions s
        LEFT JOIN academic_terms at ON at.id = s.academic_term_id
        WHERE TRIM(s.code) = ANY(${variants}::text[])
        LIMIT 1
      `
    }
    const r = rows[0]
    const desc = r?.description ? String(r.description).trim() : ""
    coverLines.push(desc ? `Section: ${session} (${desc})` : `Section: ${session}`)
    if (r?.term != null && r?.year != null) {
      const tl = String(r.term)
      const yl = r.year
      coverLines.push(`Semester: ${tl} ${yl}`)
      semesterSlug = sanitizeFilenameSegment(`${tl}-${yl}`)
      addedSemesterLine = true
    }
  } else {
    coverLines.push("Sections: All")
  }

  if (!addedSemesterLine) {
    try {
      const t = await sql`
        SELECT term, year FROM academic_terms
        WHERE is_active = true
        ORDER BY year DESC,
          CASE term WHEN 'Spring' THEN 1 WHEN 'Summer' THEN 2 WHEN 'Fall' THEN 3 WHEN 'Winter' THEN 4 END DESC
        LIMIT 1
      `
      if (t.length > 0) {
        const tl = String(t[0].term)
        const yl = t[0].year
        coverLines.push(`Academic term: ${tl} ${yl}`)
        semesterSlug = sanitizeFilenameSegment(`${tl}-${yl}`)
      }
    } catch {
      /* optional table */
    }
  }

  const sessSlug = session && session !== "all" ? sanitizeFilenameSegment(session) : "all-sections"
  const ccSlug = courseCode ? `${sanitizeFilenameSegment(courseCode)}-` : ""
  const filenameStem = `${ccSlug}${reportKind}-${sessSlug}-${semesterSlug}-${Date.now()}`

  return { coverLines, filenameStem }
}
