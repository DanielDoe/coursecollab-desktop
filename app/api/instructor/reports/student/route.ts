import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAttemptDisplayGrade } from "@/lib/attempt-grade-display"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { loadInstructorActor } from "@/lib/instructor-actor-scope"
import { sqlQuizVisibleInCourse } from "@/lib/quiz-course-access"
import { studentOfferingAndSql } from "@/lib/instructor-session-scope"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(req: NextRequest) {
  try {
    const scope = await requireInstructorCourse(req)
    if (!scope.ok) return scope.response
    const platformCourseId = scope.course.id
    const instructorId = scope.instructorId
    const actor = await loadInstructorActor(instructorId)
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const courseOwnerId = Number(scope.course.instructor_id)
    const offeringS = studentOfferingAndSql(req, platformCourseId, "s")

    const { searchParams } = req.nextUrl
    const q = (searchParams.get("q") || "").trim()
    const studentIdRaw = searchParams.get("studentId")

    if (studentIdRaw) {
      const studentId = parseInt(studentIdRaw, 10)
      if (!Number.isFinite(studentId)) {
        return NextResponse.json({ error: "Invalid studentId" }, { status: 400 })
      }

      const rows = await sql`
        SELECT
          s.id,
          s.full_name,
          s.student_id,
          s.email,
          s.section,
          sess.code AS session_catalog_code
        FROM students s
        INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
        WHERE s.id = ${studentId}
          AND (s.deleted_at IS NULL)
          ${offeringS}
        LIMIT 1
      `
      const studentRow = rows[0] as
        | {
            id: number
            full_name: string | null
            student_id: unknown
            email: string | null
            section: string | null
            session_catalog_code: string | null
          }
        | undefined

      if (!studentRow) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }

      const attemptRows = await sql`
        SELECT
          qa.id AS attempt_id,
          qa.quiz_id,
          q.title AS quiz_title,
          q.assessment_type,
          qa.completed_at,
          COALESCE(qa.tab_switch_count, 0)::int AS tab_switch_count,
          COALESCE(qa.copy_paste_attempts, 0)::int AS copy_paste_attempts
        FROM quiz_attempts qa
        INNER JOIN quizzes q ON q.id = qa.quiz_id AND q.deleted_at IS NULL AND ${sqlQuizVisibleInCourse("q", actor, instructorId, courseOwnerId, platformCourseId)}
        WHERE qa.student_id = ${studentId}
          AND qa.completed_at IS NOT NULL
          AND qa.deleted_at IS NULL
        ORDER BY qa.completed_at DESC
        LIMIT 200
      `

      const attemptList = attemptRows as Array<{
        attempt_id: number
        quiz_id: number
        quiz_title: string | null
        assessment_type: string | null
        completed_at: string | null
        tab_switch_count: number
        copy_paste_attempts: number
      }>

      const grades = await Promise.all(
        attemptList.map((a) => getAttemptDisplayGrade(String(a.attempt_id))),
      )

      const attempts = attemptList.map((a, i) => {
        const g = grades[i]
        return {
          attemptId: Number(a.attempt_id),
          quizId: Number(a.quiz_id),
          quizTitle: a.quiz_title || "(Untitled)",
          assessmentType: a.assessment_type || "quiz",
          completedAt: a.completed_at,
          displayScore: g?.score ?? 0,
          displayTotal: g?.totalPoints ?? 0,
          percentage: g?.percentage ?? 0,
          tabSwitches: a.tab_switch_count,
          copyPasteAttempts: a.copy_paste_attempts,
        }
      })

      const percentages = attempts
        .map((a) => a.percentage)
        .filter((n) => Number.isFinite(n))
      const avgPercentage =
        percentages.length > 0
          ? Math.round(
              (percentages.reduce((s, n) => s + n, 0) / percentages.length) * 10,
            ) / 10
          : 0

      let gradebook: Record<string, unknown> | null = null
      const section = studentRow.section?.trim() || ""
      if (section) {
        try {
          const sessionKey = await normalizeSessionForStorage(section)
          const gr = await sql`
            SELECT
              quiz_score,
              homework_score,
              midterm_score,
              final_score,
              attendance_score,
              project_score,
              classroom_score,
              engagement_credits,
              total_score,
              letter_grade,
              last_calculated_at,
              session
            FROM student_grades
            WHERE student_id = ${studentId}
              AND session = ${sessionKey}
            LIMIT 1
          `
          gradebook = (gr[0] as Record<string, unknown>) ?? null
        } catch {
          gradebook = null
        }
      }
      if (!gradebook) {
        const gr = await sql`
          SELECT
            quiz_score,
            homework_score,
            midterm_score,
            final_score,
            attendance_score,
            project_score,
            classroom_score,
            engagement_credits,
            total_score,
            letter_grade,
            last_calculated_at,
            session
          FROM student_grades
          WHERE student_id = ${studentId}
          ORDER BY last_calculated_at DESC NULLS LAST
          LIMIT 1
        `
        gradebook = (gr[0] as Record<string, unknown>) ?? null
      }

      const payload = {
        student: {
          id: studentRow.id,
          fullName: studentRow.full_name || "Unknown",
          studentNumber: studentRow.student_id ?? null,
          email: studentRow.email || "",
          section: studentRow.section,
          sessionCatalogCode: studentRow.session_catalog_code,
        },
        gradebook,
        attempts,
        summary: {
          completedAttempts: attempts.length,
          avgPercentage,
        },
        generatedAt: new Date().toISOString(),
      }

      return NextResponse.json({ success: true, report: payload })
    }

    if (q.length < 2) {
      return NextResponse.json({ success: true, students: [] })
    }

    const pattern = `%${q}%`
    const students = await sql`
      SELECT
        s.id,
        s.full_name,
        s.student_id,
        s.email,
        s.section,
        sess.code AS session_catalog_code
      FROM students s
      INNER JOIN sessions sess ON sess.id = s.session_id AND sess.course_id = ${platformCourseId}
      WHERE (s.deleted_at IS NULL)
        ${offeringS}
        AND (          s.full_name ILIKE ${pattern}
          OR s.email ILIKE ${pattern}
          OR CAST(s.student_id AS TEXT) ILIKE ${pattern}
        )
      ORDER BY s.full_name ASC
      LIMIT 25
    `

    return NextResponse.json({
      success: true,
      students: (students as Array<Record<string, unknown>>).map((r) => ({
        id: Number(r.id),
        fullName: (r.full_name as string) || "Unknown",
        studentNumber: r.student_id ?? null,
        email: (r.email as string) || "",
        section: r.section as string | null,
        sessionCatalogCode: r.session_catalog_code as string | null,
      })),
    })
  } catch (e) {
    console.error("[instructor/reports/student]", e)
    return NextResponse.json(
      { error: "Failed to load student report" },
      { status: 500 },
    )
  }
}
