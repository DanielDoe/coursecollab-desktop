import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { resolveStudentDatabaseIdFromParam } from "@/lib/resolve-student-db-id"
import {
  resolveStudentCourseContextByDbId,
  type StudentCourseContext,
} from "@/lib/student-course-scope"
import { fetchPracticeTopicAvailabilityForSession } from "@/lib/practice-topic-availability"
import { buildInstructorOwnedCourseScopeSqlFragment } from "@/lib/instructor-default-courses"

/** Same ELEG1301/ELEG1304/LEGACY shared bank rules as faculty question-bank scope. */
export async function buildStudentPracticeQuestionBankScopeSqlFragment(
  tableAlias: string,
  courseIdColumn: string,
  courseId: number,
  practiceSession?: string | null,
) {
  const cid = Math.trunc(Number(courseId))
  if (!Number.isFinite(cid) || cid < 1) return sql.unsafe(`(FALSE)`)

  const rows = await sql`
    SELECT instructor_id, course_code FROM courses WHERE id = ${cid} LIMIT 1
  `
  if (!rows.length) return sql.unsafe(`(FALSE)`)

  const instructorId = Number(rows[0].instructor_id)
  const courseCode = String(rows[0].course_code ?? "")
  if (!Number.isFinite(instructorId) || instructorId < 1) {
    const col = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(courseIdColumn) ? courseIdColumn : "course_id"
    const a = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableAlias) ? tableAlias : "qb"
    return sql.unsafe(`(${a}.${col} = ${cid})`)
  }

  return buildInstructorOwnedCourseScopeSqlFragment(
    tableAlias,
    courseIdColumn,
    cid,
    instructorId,
    { scopeCourseCode: courseCode, selectedSessionCode: practiceSession ?? null },
  )
}

function sessionKeysForPractice(practiceSession: string, variants: string[]) {
  return new Set(
    [practiceSession, ...variants]
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0 && value.toUpperCase() !== "ALL"),
  )
}

function isPracticeTopicHidden(
  topicName: string,
  sessionRows: Awaited<ReturnType<typeof fetchPracticeTopicAvailabilityForSession>>,
  allRows: Awaited<ReturnType<typeof fetchPracticeTopicAvailabilityForSession>>,
  practiceSession: string,
  variants: string[],
) {
  const name = String(topicName ?? "").trim()
  const keys = sessionKeysForPractice(practiceSession, variants)
  const sessionRow = sessionRows.find((row) => String(row.topic).trim() === name && keys.has(row.session.trim()))
  if (sessionRow) return !sessionRow.is_available
  const allRow = allRows.find((row) => String(row.topic).trim() === name)
  if (allRow) return !allRow.is_available
  return false
}

async function hiddenPracticeTopicNames(practiceSession: string, variants: string[]) {
  const [sessionRows, allRows] = await Promise.all([
    fetchPracticeTopicAvailabilityForSession(practiceSession, variants),
    fetchPracticeTopicAvailabilityForSession("ALL", []),
  ])
  const names = new Set<string>()
  for (const row of [...sessionRows, ...allRows]) {
    if (isPracticeTopicHidden(row.topic, sessionRows, allRows, practiceSession, variants)) {
      names.add(String(row.topic).trim())
    }
  }
  return names
}

export type StudentPracticeContext = StudentCourseContext & {
  practiceSession: string
  sessionVariants: string[]
}

/**
 * Resolve practice course/session from an already-authenticated caller db id.
 * Query `studentId` is not identity — callers must bind the session first.
 * Course mismatch stays 403.
 */
export async function resolveStudentPracticeContextForCaller(
  studentDbId: number,
  sessionParam: string | null,
  courseIdParam: string | null,
): Promise<
  | { ok: true; ctx: StudentPracticeContext }
  | { ok: false; response: NextResponse }
> {
  const base = await resolveStudentCourseContextByDbId(studentDbId)
  if (!base) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student not found" }, { status: 404 }),
    }
  }

  if (courseIdParam) {
    const requested = Number(courseIdParam)
    if (Number.isFinite(requested) && requested !== base.courseId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Course mismatch for student" }, { status: 403 }),
      }
    }
  }

  const practiceSession =
    sessionParam?.trim() || base.sessionCode?.trim() || base.section?.trim() || "ALL"
  const sessionVariants = normalizedSectionVariantsForSql(practiceSession)

  return {
    ok: true,
    ctx: {
      ...base,
      practiceSession,
      sessionVariants,
    },
  }
}

export async function resolveStudentPracticeContextFromParams(
  studentIdParam: string | null,
  sessionParam: string | null,
  courseIdParam: string | null,
): Promise<
  | { ok: true; ctx: StudentPracticeContext }
  | { ok: false; response: NextResponse }
> {
  if (!studentIdParam?.trim()) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student ID required" }, { status: 400 }),
    }
  }

  const studentDbId = await resolveStudentDatabaseIdFromParam(studentIdParam.trim())
  if (studentDbId == null) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Student not found" }, { status: 404 }),
    }
  }

  return resolveStudentPracticeContextForCaller(studentDbId, sessionParam, courseIdParam)
}

/** Topics from the student's course bank, respecting optional practice_topic_availability. */
export async function listPracticeTopicsWithProgress(
  studentDbId: number,
  ctx: StudentPracticeContext,
) {
  const { courseId, practiceSession, sessionVariants } = ctx
  const variants = sessionVariants.length > 0 ? sessionVariants : [practiceSession]
  const hidden = await hiddenPracticeTopicNames(practiceSession, variants)
  const qbScope = await buildStudentPracticeQuestionBankScopeSqlFragment(
    "qb",
    "course_id",
    courseId,
    practiceSession,
  )

  const rows = await sql`
    SELECT
      qb.topic AS name,
      COUNT(DISTINCT qb.id)::int AS question_count,
      COALESCE(stp.questions_completed, 0) AS completed,
      COALESCE(stp.questions_correct, 0) AS correct,
      COALESCE(stp.accuracy, 0) AS accuracy,
      stp.last_practiced
    FROM question_bank qb
    LEFT JOIN student_topic_progress stp
      ON qb.topic = stp.topic AND stp.student_id = ${studentDbId}
    WHERE qb.deleted_at IS NULL
      AND (${qbScope})
      AND qb.topic IS NOT NULL
      AND TRIM(qb.topic::text) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM practice_question_availability pqa
        WHERE pqa.question_id = qb.id
          AND pqa.is_available = false
          AND (
            TRIM(pqa.session::text) = 'ALL'
            OR TRIM(pqa.session::text) = TRIM(${practiceSession}::text)
            OR TRIM(pqa.session::text) = ANY(${variants}::text[])
          )
      )
    GROUP BY qb.topic, stp.questions_completed, stp.questions_correct, stp.accuracy, stp.last_practiced
    ORDER BY qb.topic ASC
  `
  return rows.filter((row) => !hidden.has(String(row.name ?? "").trim()))
}

export async function listPracticeTopicsForCourse(
  courseId: number,
  practiceSession: string,
  sessionVariants: string[],
) {
  const variants = sessionVariants.length > 0 ? sessionVariants : [practiceSession]
  const hidden = await hiddenPracticeTopicNames(practiceSession, variants)
  const qbScope = await buildStudentPracticeQuestionBankScopeSqlFragment(
    "qb",
    "course_id",
    courseId,
    practiceSession,
  )

  const rows = await sql`
    SELECT
      qb.topic AS name,
      COUNT(*)::int AS question_count
    FROM question_bank qb
    WHERE qb.deleted_at IS NULL
      AND (${qbScope})
      AND qb.topic IS NOT NULL
      AND TRIM(qb.topic::text) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM practice_question_availability pqa
        WHERE pqa.question_id = qb.id
          AND pqa.is_available = false
          AND (
            TRIM(pqa.session::text) = 'ALL'
            OR TRIM(pqa.session::text) = TRIM(${practiceSession}::text)
            OR TRIM(pqa.session::text) = ANY(${variants}::text[])
          )
      )
    GROUP BY qb.topic
    ORDER BY qb.topic ASC
  `
  return rows.filter((row) => !hidden.has(String(row.name ?? "").trim()))
}
