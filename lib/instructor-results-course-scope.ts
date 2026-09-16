import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
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

/** Students in this course via course_id or catalog session — never section-code text. */
export function studentInSelectedCourseSql(
  courseId: number,
  courseCode?: string | null,
  options?: StudentCourseSqlOptions,
): string {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return "(FALSE)"

  if (options?.reviewSandbox) {
    return `(
      (
        s.course_id = ${cid}
        OR EXISTS (
          SELECT 1 FROM sessions sess_scoped
          WHERE sess_scoped.id = s.session_id AND sess_scoped.course_id = ${cid}
        )
      )
      AND (s.student_id ~ '^910000\\d{3}$' OR s.student_id ~ '^910100\\d{3}$')
    )`
  }

  void courseCode
  return studentInInstructorSessionScopeSql({ courseId: cid })
}

/** Course roster for the current offering only — never reuse section codes from older terms. */
export function studentOnCourseActiveTermSql(courseId: number): string {
  return studentInInstructorSessionScopeSql({ courseId })
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
  return studentOnCourseActiveTermSql(courseId)
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
