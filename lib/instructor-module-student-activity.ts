import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { ensureCourseNoteViewsSchema } from "@/lib/course-note-view-scoring"
import { ensureFlashcardStudySchema } from "@/lib/flashcard-study-engagement"
import {
  buildLectureInstructorCourseScopeSqlFragment,
  syncLectureCourseIdsForElegEceInstructor,
} from "@/lib/instructor-default-courses"
import { readInstructorSessionScopeFromRequest, studentInInstructorSessionScopeSql } from "@/lib/instructor-session-scope"
import { ensureSyllabusSchema } from "@/lib/ensure-syllabus-schema"
import { getSyllabusByCourseId } from "@/lib/syllabus/syllabus-service"
import { SYLLABUS_VIEW_POINTS } from "@/lib/syllabus/syllabus-view-points"

export type InstructorModuleActivityKind = "syllabus" | "flashcards" | "notes" | "lectures"

export type ModuleStudentActivityRow = {
  studentDbId: number
  studentId: string
  fullName: string
  email: string | null
  section: string | null
  sessionCode: string | null
  engaged: boolean
  lastActivityAt: string | null
  pointsAwarded: number
  activityCount: number
  activityLabel: string
  detail: string | null
}

export type ModuleStudentActivityPayload = {
  module: InstructorModuleActivityKind
  summary: {
    totalStudents: number
    engagedStudents: number
    notStartedStudents: number
    totalPointsAwarded: number
  }
  meta?: Record<string, unknown>
  students: ModuleStudentActivityRow[]
}

function scopeSql(courseId: number, request: NextRequest): string {
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  return studentInInstructorSessionScopeSql({
    courseId,
    sessionId: sessionScope.sessionId,
    academicTermId: sessionScope.academicTermId,
  })
}

export async function fetchSyllabusStudentActivity(
  courseId: number,
  request: NextRequest,
): Promise<ModuleStudentActivityPayload> {
  await ensureSyllabusSchema()
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  const syllabus = await getSyllabusByCourseId(courseId, sessionScope.sessionId)
  const scopeWhere = scopeSql(courseId, request)

  if (!syllabus) {
    return {
      module: "syllabus",
      summary: { totalStudents: 0, engagedStudents: 0, notStartedStudents: 0, totalPointsAwarded: 0 },
      meta: { syllabusPublished: false },
      students: [],
    }
  }

  const rows = (await sql`
    SELECT
      s.id AS student_db_id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      sess.code AS session_code,
      MAX(sv.viewed_at) AS last_activity_at,
      COALESCE(MAX(sv.points_awarded), 0)::float8 AS points_awarded,
      COUNT(sv.id)::int AS view_count
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN syllabus_views sv
      ON sv.student_id = s.id AND sv.syllabus_id = ${syllabus.id}
    WHERE ${sql.unsafe(scopeWhere)}
    GROUP BY s.id, s.student_id, s.full_name, s.email, s.section, sess.code
    ORDER BY s.full_name ASC
  `) as {
    student_db_id: number
    student_id: string
    full_name: string
    email: string | null
    section: string | null
    session_code: string | null
    last_activity_at: string | null
    points_awarded: number
    view_count: number
  }[]

  const students = rows.map((row) => {
    const engaged = row.view_count > 0
    const points = Number(row.points_awarded) || 0
    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      section: row.section,
      sessionCode: row.session_code,
      engaged,
      lastActivityAt: row.last_activity_at,
      pointsAwarded: points,
      activityCount: row.view_count,
      activityLabel: engaged ? "Viewed" : "Not viewed",
      detail:
        points > 0
          ? `Awarded ${points} engagement credit${points === 1 ? "" : "s"}`
          : engaged
            ? "Viewed — no points (already awarded on prior revision or not eligible)"
            : null,
    }
  })

  return buildPayload("syllabus", students, {
    syllabusPublished: syllabus.status === "published",
    syllabusTitle: syllabus.title,
    pointsPossible: SYLLABUS_VIEW_POINTS,
  })
}

export async function fetchFlashcardsStudentActivity(
  courseId: number,
  request: NextRequest,
): Promise<ModuleStudentActivityPayload> {
  await ensureFlashcardStudySchema()
  const scopeWhere = scopeSql(courseId, request)

  const rows = (await sql`
    SELECT
      s.id AS student_db_id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      sess.code AS session_code,
      COUNT(DISTINCT e.deck_id)::int AS decks_studied,
      COUNT(e.id)::int AS study_events,
      COALESCE(SUM(e.points_awarded), 0)::int AS points_awarded,
      MAX(e.completed_at) AS last_activity_at
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN flashcard_study_events e ON e.student_id = s.id
    LEFT JOIN flashcard_decks d ON d.id = e.deck_id AND d.course_id = ${courseId} AND d.deleted_at IS NULL
    WHERE ${sql.unsafe(scopeWhere)}
      AND (e.id IS NULL OR d.id IS NOT NULL)
    GROUP BY s.id, s.student_id, s.full_name, s.email, s.section, sess.code
    ORDER BY s.full_name ASC
  `) as {
    student_db_id: number
    student_id: string
    full_name: string
    email: string | null
    section: string | null
    session_code: string | null
    decks_studied: number
    study_events: number
    points_awarded: number
    last_activity_at: string | null
  }[]

  const students = rows.map((row) => {
    const engaged = row.study_events > 0
    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      section: row.section,
      sessionCode: row.session_code,
      engaged,
      lastActivityAt: row.last_activity_at,
      pointsAwarded: row.points_awarded,
      activityCount: row.decks_studied,
      activityLabel: engaged ? `${row.decks_studied} deck${row.decks_studied === 1 ? "" : "s"}` : "No study sessions",
      detail: engaged ? `${row.study_events} study event${row.study_events === 1 ? "" : "s"}` : null,
    }
  })

  return buildPayload("flashcards", students)
}

export async function fetchNotesStudentActivity(
  courseId: number,
  request: NextRequest,
): Promise<ModuleStudentActivityPayload> {
  await ensureCourseNoteViewsSchema()
  const scopeWhere = scopeSql(courseId, request)

  const rows = (await sql`
    SELECT
      s.id AS student_db_id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      sess.code AS session_code,
      COUNT(DISTINCT v.note_id)::int AS notes_read,
      COUNT(v.id)::int AS read_events,
      MAX(v.viewed_at) AS last_activity_at
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN course_note_views v ON v.student_id = s.id
    LEFT JOIN course_digital_notes n
      ON n.id = v.note_id AND n.course_id = ${courseId} AND n.deleted_at IS NULL
    WHERE ${sql.unsafe(scopeWhere)}
      AND (v.id IS NULL OR n.id IS NOT NULL)
    GROUP BY s.id, s.student_id, s.full_name, s.email, s.section, sess.code
    ORDER BY s.full_name ASC
  `) as {
    student_db_id: number
    student_id: string
    full_name: string
    email: string | null
    section: string | null
    session_code: string | null
    notes_read: number
    read_events: number
    last_activity_at: string | null
  }[]

  const students = rows.map((row) => {
    const engaged = row.notes_read > 0
    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      section: row.section,
      sessionCode: row.session_code,
      engaged,
      lastActivityAt: row.last_activity_at,
      pointsAwarded: 0,
      activityCount: row.notes_read,
      activityLabel: engaged
        ? `${row.notes_read} note${row.notes_read === 1 ? "" : "s"} read`
        : "No reads",
      detail: engaged ? `${row.read_events} counted read${row.read_events === 1 ? "" : "s"} this term` : null,
    }
  })

  return buildPayload("notes", students)
}

export async function fetchLecturesStudentActivity(
  courseId: number,
  instructorId: number,
  courseCode: string,
  request: NextRequest,
): Promise<ModuleStudentActivityPayload> {
  const scopeWhere = scopeSql(courseId, request)
  await syncLectureCourseIdsForElegEceInstructor(instructorId)
  const sessionScope = readInstructorSessionScopeFromRequest(request)
  let selectedSessionCode: string | null = null
  if (sessionScope.sessionId != null) {
    const sessionRows = (await sql`
      SELECT code FROM sessions WHERE id = ${sessionScope.sessionId} LIMIT 1
    `) as { code: string }[]
    selectedSessionCode = sessionRows[0]?.code?.trim() ?? null
  }
  const lectureScope = await buildLectureInstructorCourseScopeSqlFragment(
    courseId,
    instructorId,
    courseCode,
    selectedSessionCode,
  )

  const rows = (await sql`
    SELECT
      s.id AS student_db_id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      sess.code AS session_code,
      COUNT(DISTINCT lv.lecture_id)::int AS lectures_opened,
      COUNT(DISTINCT CASE WHEN COALESCE(lsp.progress_percentage, 0) >= 100 THEN lsp.lecture_id END)::int AS lectures_completed,
      MAX(GREATEST(lv.viewed_at, lsp.last_accessed)) AS last_activity_at
    FROM students s
    JOIN sessions sess ON sess.id = s.session_id
    LEFT JOIN lecture_views lv ON lv.student_id = s.id
    LEFT JOIN lectures l
      ON l.id = lv.lecture_id
      AND COALESCE(l.is_published, true)
      AND l.deleted_at IS NULL
      AND (${lectureScope})
    LEFT JOIN lecture_student_progress lsp
      ON lsp.student_id = s.id
      AND lsp.lecture_id = l.id
    WHERE ${sql.unsafe(scopeWhere)}
      AND (lv.id IS NULL OR l.id IS NOT NULL)
    GROUP BY s.id, s.student_id, s.full_name, s.email, s.section, sess.code
    ORDER BY s.full_name ASC
  `) as {
    student_db_id: number
    student_id: string
    full_name: string
    email: string | null
    section: string | null
    session_code: string | null
    lectures_opened: number
    lectures_completed: number
    last_activity_at: string | null
  }[]

  const students = rows.map((row) => {
    const engaged = row.lectures_opened > 0
    return {
      studentDbId: row.student_db_id,
      studentId: row.student_id,
      fullName: row.full_name,
      email: row.email,
      section: row.section,
      sessionCode: row.session_code,
      engaged,
      lastActivityAt: row.last_activity_at,
      pointsAwarded: 0,
      activityCount: row.lectures_opened,
      activityLabel: engaged
        ? `${row.lectures_opened} opened · ${row.lectures_completed} completed`
        : "Not started",
      detail: engaged ? "Slide progress counts toward engagement credits" : null,
    }
  })

  return buildPayload("lectures", students)
}

function buildPayload(
  module: InstructorModuleActivityKind,
  students: ModuleStudentActivityRow[],
  meta?: Record<string, unknown>,
): ModuleStudentActivityPayload {
  const engagedStudents = students.filter((s) => s.engaged).length
  return {
    module,
    summary: {
      totalStudents: students.length,
      engagedStudents,
      notStartedStudents: students.length - engagedStudents,
      totalPointsAwarded: students.reduce((sum, s) => sum + (s.pointsAwarded || 0), 0),
    },
    meta,
    students,
  }
}
