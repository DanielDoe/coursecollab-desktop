import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"
import { isAppStoreReviewSandboxCourseCode } from "@/lib/app-store-review-accounts"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  readInstructorSessionScopeFromRequest,
  studentInInstructorSessionScopeSql,
  type InstructorSessionScope,
} from "@/lib/instructor-session-scope"

export type InstructorResultsCourseScope = {
  scopedCourseId: number | null
  studentFilter: ReturnType<typeof sql>
  quizFilter: ReturnType<typeof sql>
}

type StudentCourseSqlOptions = {
  /** App Store review sandbox — never prefix-match live catalog codes; demo roster only. */
  reviewSandbox?: boolean
}

/** Students in this course via course_id, catalog session, or section/session code (ECE2202, ELEG1301P01). */
export function studentInSelectedCourseSql(
  courseId: number,
  courseCode?: string | null,
  options?: StudentCourseSqlOptions,
): string {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return "(FALSE)"

  const enrolledOnCourse = `(
    s.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM sessions sess_scoped
      WHERE sess_scoped.id = s.session_id AND sess_scoped.course_id = ${cid}
    )
  )`

  if (options?.reviewSandbox) {
    return `(
      ${enrolledOnCourse}
      AND (s.student_id ~ '^910000\\d{3}$' OR s.student_id ~ '^910100\\d{3}$')
    )`
  }

  const prefix = normalizeCatalogCourseCode(courseCode).replace(/[^A-Z0-9]/g, "")
  const textMatch = prefix
    ? `OR TRIM(UPPER(REPLACE(COALESCE(s.section, ''), ' ', ''))) LIKE '${prefix}%'
       OR EXISTS (
         SELECT 1 FROM sessions sess_code
         WHERE sess_code.id = s.session_id
           AND TRIM(UPPER(REPLACE(COALESCE(sess_code.code, ''), ' ', ''))) LIKE '${prefix}%'
       )`
    : ""
  return `(
    s.course_id = ${cid}
    OR EXISTS (
      SELECT 1 FROM sessions sess_scoped
      WHERE sess_scoped.id = s.session_id AND sess_scoped.course_id = ${cid}
    )
    ${textMatch}
  )`
}

export function studentInSelectedCourseSqlForCourse(
  courseId: number,
  courseCode?: string | null,
  sessionScope?: InstructorSessionScope | null,
): string {
  if (isAppStoreReviewSandboxCourseCode(courseCode)) {
    return studentInSelectedCourseSql(courseId, courseCode, { reviewSandbox: true })
  }
  if (sessionScope?.sessionId || sessionScope?.academicTermId) {
    return studentInInstructorSessionScopeSql({
      courseId,
      sessionId: sessionScope.sessionId,
      academicTermId: sessionScope.academicTermId,
    })
  }
  return studentInSelectedCourseSql(courseId, courseCode)
}

export function resolveStudentScopeSqlFromRequest(
  request: NextRequest,
  courseId: number,
  courseCode?: string | null,
): string {
  return studentInSelectedCourseSqlForCourse(
    courseId,
    courseCode,
    readInstructorSessionScopeFromRequest(request),
  )
}

export async function resolveInstructorResultsCourseScope(
  request: NextRequest,
): Promise<
  | { ok: true; scope: InstructorResultsCourseScope }
  | { ok: false; response: NextResponse }
> {
  if (!request.headers.get("x-course-id")) {
    return {
      ok: true,
      scope: {
        scopedCourseId: null,
        studentFilter: sql.unsafe(""),
        quizFilter: sql.unsafe(""),
      },
    }
  }

  const scoped = await requireInstructorCourse(request)
  if (!scoped.ok) {
    return { ok: false, response: scoped.response }
  }

  const scopedCourseId = scoped.course.id
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  const studentPred = studentInSelectedCourseSqlForCourse(
    scopedCourseId,
    scoped.course.course_code,
    sessionScope,
  )
  const studentFilter = sql.unsafe(`AND ${studentPred}`)
  const quizFilter = sql.unsafe("")

  return { ok: true, scope: { scopedCourseId, studentFilter, quizFilter } }
}

export function sessionCourseFilter(scopedCourseId: number | null) {
  return scopedCourseId != null ? sql.unsafe(`AND course_id = ${scopedCourseId}`) : sql.unsafe("")
}
