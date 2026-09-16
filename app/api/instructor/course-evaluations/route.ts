import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { computeCourseEvaluationAnalytics } from "@/lib/course-evaluation-analytics"
import {
  COURSE_EVALUATION_SESSION_JOIN,
  courseEvaluationCourseAndClause,
} from "@/lib/course-evaluation-course-scope"
import { studentOfferingAndSql } from "@/lib/instructor-session-scope"
import { ensureCourseEvaluationSchema } from "@/lib/ensure-course-evaluation-schema"
import { recalculateAndSaveGrade } from "@/lib/grades"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { normalizeCatalogCourseCode } from "@/lib/course-section-model"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const GRADE_JOIN = sql.unsafe(`
  LEFT JOIN LATERAL (
    SELECT sg.total_score, sg.letter_grade
    FROM student_grades sg
    WHERE sg.student_id = ce.student_id
    ORDER BY
      CASE
        WHEN sg.session = ce.session THEN 0
        WHEN sg.session = s.section THEN 1
        ELSE 2
      END,
      sg.last_calculated_at DESC NULLS LAST
    LIMIT 1
  ) sg ON true
`)

async function resolveCourseScope(request: NextRequest) {
  if (!request.headers.get("x-course-id")) {
    return { ok: true as const, courseId: null as number | null, courseCode: "" }
  }
  const scope = await requireInstructorCourse(request)
  if (!scope.ok) return scope
  return {
    ok: true as const,
    courseId: scope.course.id,
    courseCode: normalizeCatalogCourseCode(scope.course.course_code),
  }
}

export async function GET(request: NextRequest) {
  try {
    await ensureCourseEvaluationSchema()
    const { searchParams } = new URL(request.url)
    const sessionRaw = (searchParams.get("session") ?? "all").trim()
    const sessionCode = sessionRaw.toLowerCase() === "all" || !sessionRaw ? "all" : sessionRaw
    const statusRaw = (searchParams.get("status") ?? "pending").trim().toLowerCase()
    const status = ["all", "pending", "approved", "rejected", "draft"].includes(statusRaw)
      ? statusRaw
      : "pending"
    const view = (searchParams.get("view") ?? "").trim()
    const idRaw = searchParams.get("id")
    const evalId = idRaw ? parseInt(idRaw, 10) : NaN
    const courseScope = await resolveCourseScope(request)
    if (!courseScope.ok) return courseScope.response
    const courseClause = courseEvaluationCourseAndClause(courseScope.courseId, courseScope.courseCode)
    const offeringAnd = studentOfferingAndSql(request, courseScope.courseId, "s")

    if (view === "analytics") {
      const analytics = await computeCourseEvaluationAnalytics(sessionCode, {
        courseId: courseScope.courseId,
        courseCode: courseScope.courseCode,
        offeringAnd,
      })
      return NextResponse.json({ success: true, analytics })
    }

    if (Number.isFinite(evalId) && evalId > 0) {
      const rows = await sql`
        SELECT ce.*, s.full_name, s.student_id AS student_code, s.section,
          (SELECT COUNT(*)::int FROM course_evaluation_proofs p WHERE p.evaluation_id = ce.id) AS proof_count
        FROM course_evaluations ce
        JOIN students s ON s.id = ce.student_id
        ${COURSE_EVALUATION_SESSION_JOIN}
        WHERE ce.id = ${evalId}
          ${courseClause}
          ${offeringAnd}
        LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      const evalRow = rows[0] as { student_id: number; session: string; section?: string | null }
      const [gradeRow] = await sql`
        SELECT sg.total_score, sg.letter_grade
        FROM student_grades sg
        WHERE sg.student_id = ${evalRow.student_id}
        ORDER BY
          CASE
            WHEN sg.session = ${evalRow.session} THEN 0
            WHEN sg.session = ${evalRow.section ?? ""} THEN 1
            ELSE 2
          END,
          sg.last_calculated_at DESC NULLS LAST
        LIMIT 1
      `
      const grade = (gradeRow ?? {}) as { total_score?: number | null; letter_grade?: string | null }
      const proofs = await sql`
        SELECT id, url, file_name, mime, uploaded_at
        FROM course_evaluation_proofs
        WHERE evaluation_id = ${evalId}
        ORDER BY uploaded_at ASC
      `
      return NextResponse.json({
        success: true,
        evaluation: {
          ...rows[0],
          actual_total_score: grade.total_score ?? null,
          actual_letter_grade: grade.letter_grade ?? null,
          proofs,
        },
      })
    }

    const statusClause =
      status === "all" ? sql.unsafe("ce.id > 0") : sql.unsafe(`ce.status = '${status.replace(/'/g, "''")}'`)
    const listOrderClause = sql.unsafe("ORDER BY ce.submitted_at ASC NULLS LAST")

    let rows
    if (sessionCode === "all" || !sessionCode) {
      rows = await sql`
        SELECT ce.*, s.full_name, s.student_id AS student_code, s.section,
          sg.total_score AS actual_total_score, sg.letter_grade AS actual_letter_grade,
          (SELECT COUNT(*)::int FROM course_evaluation_proofs p WHERE p.evaluation_id = ce.id) AS proof_count
        FROM course_evaluations ce
        JOIN students s ON s.id = ce.student_id
        ${COURSE_EVALUATION_SESSION_JOIN}
        ${GRADE_JOIN}
        WHERE ${statusClause}
          ${courseClause}
          ${offeringAnd}
        ${listOrderClause}
        LIMIT 200
      `
    } else if (status === "all") {
      rows = await sql`
        SELECT ce.*, s.full_name, s.student_id AS student_code, s.section,
          sg.total_score AS actual_total_score, sg.letter_grade AS actual_letter_grade,
          (SELECT COUNT(*)::int FROM course_evaluation_proofs p WHERE p.evaluation_id = ce.id) AS proof_count
        FROM course_evaluations ce
        JOIN students s ON s.id = ce.student_id
        ${COURSE_EVALUATION_SESSION_JOIN}
        ${GRADE_JOIN}
        WHERE (ce.session = ${sessionCode} OR s.section = ${sessionCode})
          ${courseClause}
          ${offeringAnd}
        ORDER BY ce.submitted_at ASC NULLS LAST
        LIMIT 200
      `
    } else {
      rows = await sql`
        SELECT ce.*, s.full_name, s.student_id AS student_code, s.section,
          sg.total_score AS actual_total_score, sg.letter_grade AS actual_letter_grade,
          (SELECT COUNT(*)::int FROM course_evaluation_proofs p WHERE p.evaluation_id = ce.id) AS proof_count
        FROM course_evaluations ce
        JOIN students s ON s.id = ce.student_id
        ${COURSE_EVALUATION_SESSION_JOIN}
        ${GRADE_JOIN}
        WHERE ce.status = ${status}
          AND (ce.session = ${sessionCode} OR s.section = ${sessionCode})
          ${courseClause}
          ${offeringAnd}
        ORDER BY ce.submitted_at ASC NULLS LAST
        LIMIT 200
      `
    }

    return NextResponse.json({ success: true, evaluations: rows })
  } catch (error) {
    console.error("[instructor/course-evaluations GET]", error)
    return NextResponse.json({ error: "Failed to load evaluations" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureCourseEvaluationSchema()
    const body = await request.json()
    const { id, action, instructorId, note } = body as {
      id?: number
      action?: "approve" | "reject"
      instructorId?: number
      note?: string
    }

    if (!id || !action) {
      return NextResponse.json({ error: "id and action required" }, { status: 400 })
    }

    const courseScope = await resolveCourseScope(request)
    if (!courseScope.ok) return courseScope.response

    const offeringAnd = studentOfferingAndSql(request, courseScope.courseId, "s")
    const rows = await sql`
      SELECT ce.*, s.section, s.course_id AS student_course_id, sess.course_id AS session_course_id
      FROM course_evaluations ce
      JOIN students s ON s.id = ce.student_id
      ${COURSE_EVALUATION_SESSION_JOIN}
      WHERE ce.id = ${id}
        ${offeringAnd}
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Evaluation not found" }, { status: 404 })
    }
    const evaluation = rows[0] as {
      id: number
      student_id: number
      session: string
      section: string
      status: string
    }

    if (evaluation.status !== "pending") {
      return NextResponse.json({ error: "Evaluation already reviewed" }, { status: 409 })
    }

    const newStatus = action === "approve" ? "approved" : "rejected"
    await sql`
      UPDATE course_evaluations
      SET status = ${newStatus},
          instructor_note = ${note?.trim() || null},
          reviewed_by = ${instructorId ?? null},
          reviewed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${id}
    `

    if (action === "approve") {
      const sessionForGrade = evaluation.session || evaluation.section || "ALL"
      try {
        await recalculateAndSaveGrade(evaluation.student_id, sessionForGrade)
      } catch (e) {
        console.warn("[course-evaluations] grade recalc:", e)
      }
    }

    const proofs = await sql`
      SELECT id, url, file_name, mime, uploaded_at
      FROM course_evaluation_proofs
      WHERE evaluation_id = ${id}
      ORDER BY uploaded_at ASC
    `

    return NextResponse.json({
      success: true,
      status: newStatus,
      message:
        action === "approve"
          ? "Course evaluation acknowledged — 50 engagement credits applied"
          : "Course evaluation returned to student",
      proofs,
    })
  } catch (error) {
    console.error("[instructor/course-evaluations POST]", error)
    return NextResponse.json({ error: "Failed to review evaluation" }, { status: 500 })
  }
}
