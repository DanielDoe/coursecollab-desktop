import { sectionFilterCodesForSql } from "@/lib/session-code-aliases"
import { resolveStudentCourseContextByDbId } from "@/lib/student-course-scope"
import { sql } from "@/lib/db"

export type StudentAnnouncementsScope = {
  studentDbId: number
  courseId: number | null
  sectionRows: string[]
}

type AnnouncementColumnSet = Set<string>

let announcementColumnsCache: AnnouncementColumnSet | null = null

async function getAnnouncementColumns(): Promise<AnnouncementColumnSet> {
  if (announcementColumnsCache) return announcementColumnsCache
  const rows = await sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'announcements'
  `
  announcementColumnsCache = new Set(
    (rows as { column_name: string }[]).map((r) => r.column_name),
  )
  return announcementColumnsCache
}

/** Resolve section + course for filtering announcements to the student's active enrollment. */
export async function resolveStudentAnnouncementsScope(
  studentDbId: number,
): Promise<StudentAnnouncementsScope | null> {
  const ctx = await resolveStudentCourseContextByDbId(studentDbId)
  if (ctx) {
    const sectionHint = ctx.sessionCode ?? ctx.section ?? ""
    return {
      studentDbId,
      courseId: ctx.courseId,
      sectionRows: sectionFilterCodesForSql(sectionHint),
    }
  }

  const rows = await sql`
    SELECT section FROM students WHERE id = ${studentDbId} LIMIT 1
  `
  if (!rows.length) return null

  const section = rows[0].section != null ? String(rows[0].section) : ""
  return {
    studentDbId,
    courseId: null,
    sectionRows: sectionFilterCodesForSql(section),
  }
}

function sectionArraySqlLiteral(sectionRows: string[]): string | null {
  if (sectionRows.length === 0) return null
  const esc = (s: string) => s.replace(/'/g, "''")
  return `ARRAY[${sectionRows.map((s) => `'${esc(s)}'`).join(", ")}]::text[]`
}

function lifecycleClauses(cols: AnnouncementColumnSet): string {
  const parts: string[] = []
  if (cols.has("is_active")) {
    parts.push("COALESCE(a.is_active, true) = true")
  }
  if (cols.has("expires_at")) {
    parts.push("(a.expires_at IS NULL OR a.expires_at > NOW())")
  }
  return parts.length > 0 ? parts.join(" AND ") : "TRUE"
}

/**
 * SQL fragment for student-visible announcements (use with `WHERE ${fragment}`).
 * Adapts to legacy (`target_session`) and redesign (`course_id` only) schemas.
 */
export async function studentAnnouncementsWhereClause(
  scope: StudentAnnouncementsScope,
): Promise<ReturnType<typeof sql.unsafe>> {
  const cols = await getAnnouncementColumns()
  const { courseId, sectionRows } = scope
  const sectionArray = sectionArraySqlLiteral(sectionRows)
  const cid =
    courseId != null && Number.isFinite(courseId) ? Math.trunc(Number(courseId)) : null
  const lifecycle = lifecycleClauses(cols)
  const hasCourseId = cols.has("course_id")
  const hasTargetSession = cols.has("target_session")
  const hasTargetStudent = cols.has("target_student_id")
  const studentDbId = scope.studentDbId
  const targetStudentClause = hasTargetStudent
    ? `(a.target_student_id IS NULL OR a.target_student_id = ${studentDbId})`
    : "TRUE"

  if (hasCourseId && hasTargetSession) {
    if (cid != null && sectionArray) {
      return sql.unsafe(`(
        (
          a.course_id = ${cid}
          AND (
            a.target_session IS NULL
            OR a.target_session = ANY(${sectionArray})
            OR LOWER(TRIM(COALESCE(a.target_session, ''))) = 'all'
          )
        )
        OR (a.course_id IS NULL AND a.target_session = ANY(${sectionArray}))
      ) AND ${targetStudentClause} AND ${lifecycle}`)
    }

    if (cid != null) {
      return sql.unsafe(`(
        a.course_id = ${cid}
        AND (
          a.target_session IS NULL
          OR LOWER(TRIM(COALESCE(a.target_session, ''))) = 'all'
        )
      ) AND ${targetStudentClause} AND ${lifecycle}`)
    }

    if (sectionArray) {
      return sql.unsafe(`(
        a.target_session = ANY(${sectionArray})
      ) AND ${targetStudentClause} AND ${lifecycle}`)
    }

    return sql.unsafe("FALSE")
  }

  if (hasCourseId && cid != null) {
    return sql.unsafe(`(a.course_id = ${cid}) AND ${targetStudentClause} AND ${lifecycle}`)
  }

  if (hasTargetSession && sectionArray) {
    return sql.unsafe(`(
      a.target_session = ANY(${sectionArray})
    ) AND ${targetStudentClause} AND ${lifecycle}`)
  }

  return sql.unsafe("FALSE")
}

/** Faculty list: selected course, plus selected section when `x-session-id` resolves. */
export async function facultyAnnouncementsWhereClause(
  courseId: number,
  sessionCode: string | null,
): Promise<ReturnType<typeof sql.unsafe>> {
  const cols = await getAnnouncementColumns()
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe("FALSE")
  if (!cols.has("course_id")) return sql.unsafe("FALSE")

  const hasTargetSession = cols.has("target_session")
  const code = sessionCode?.trim() ?? ""
  const sectionArray =
    hasTargetSession && code ? sectionArraySqlLiteral(sectionFilterCodesForSql(code)) : null

  if (sectionArray) {
    return sql.unsafe(`
      a.course_id = ${cid}
      AND (
        a.target_session IS NULL
        OR LOWER(TRIM(COALESCE(a.target_session, ''))) = 'all'
        OR a.target_session = ANY(${sectionArray})
      )
    `)
  }

  return sql.unsafe(`a.course_id = ${cid}`)
}
