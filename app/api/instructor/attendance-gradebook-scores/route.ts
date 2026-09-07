import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { instructorOwnsSectionVariants } from "@/lib/instructor-section-auth"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"
import { calculateLetterGrade, calculateTotalScore, getGradeWeights } from "@/lib/grades"
import { expandSessionKeysForGradeLookup, normalizeSessionForStorage } from "@/lib/session-catalog"
import { resolveOptionalCourseScope } from "@/lib/optional-instructor-course-scope"
import { requireInstructorAttendanceAccess } from "@/lib/instructor-attendance-auth"
import {
  loadAttendanceGradebookRowsRaw,
  mapAttendanceGradebookRow,
} from "@/lib/attendance-gradebook-rows-query"
import { resolveAttendanceInstructorScope } from "@/lib/attendance-instructor-scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function gradeSessionAllowedForSection(gradeSession: string, variants: string[]): boolean {
  const t = String(gradeSession ?? "").trim()
  if (!t) return false
  if (t.toUpperCase() === "ALL") return true
  const u = t.toUpperCase()
  return variants.some((v) => String(v ?? "").trim().toUpperCase() === u)
}

async function patchTargetAllowed(
  normalizedSession: string,
  variants: string[],
  studentId: number,
): Promise<boolean> {
  if (gradeSessionAllowedForSection(normalizedSession, variants)) return true
  const existingRow = await sql`
    SELECT 1 FROM student_grades sg
    WHERE sg.student_id = ${studentId} AND TRIM(sg.session) = ${normalizedSession}
    LIMIT 1
  `
  return existingRow.length > 0
}

/** Writes one `student_grades` row: manual attendance + recomputed total/letter. */
async function upsertManualAttendanceForSession(args: {
  studentId: number
  targetSession: string
  attendance: number
}): Promise<Record<string, unknown> | undefined> {
  const { studentId, targetSession, attendance } = args
  const weights = await getGradeWeights(targetSession)
  if (!weights) return undefined

  const currentGrade = await sql`
    SELECT * FROM student_grades
    WHERE student_id = ${studentId} AND session = ${targetSession}
  `

  const cur = (currentGrade[0] ?? {}) as Record<string, unknown>
  const scores = {
    quiz: Number(cur.quiz_score ?? 0) || 0,
    homework: Number(cur.homework_score ?? 0) || 0,
    midterm: Number(cur.midterm_score ?? 0) || 0,
    final: Number(cur.final_score ?? 0) || 0,
    attendance,
    project: Number(cur.project_score ?? 0) || 0,
    classroom: Number(cur.classroom_score ?? 0) || 0,
    engagement: Number(cur.engagement_credits ?? 0) || 0,
  }

  const { total, contributions } = calculateTotalScore(scores, weights)
  const letterGrade = calculateLetterGrade(total)
  const notes = cur.notes != null ? String(cur.notes) : null
  const isLocked = Boolean(cur.is_locked)

  const result = await sql`
    INSERT INTO student_grades (
      student_id, session,
      quiz_score, homework_score, midterm_score, final_score,
      attendance_score, project_score, classroom_score, engagement_credits,
      quiz_contribution, homework_contribution, midterm_contribution, final_contribution,
      attendance_contribution, project_contribution, classroom_contribution, engagement_contribution,
      total_score, letter_grade, notes, is_locked,
      attendance_manual_override
    )
    VALUES (
      ${studentId}, ${targetSession},
      ${scores.quiz}, ${scores.homework}, ${scores.midterm}, ${scores.final},
      ${scores.attendance}, ${scores.project}, ${scores.classroom}, ${scores.engagement},
      ${contributions.quiz}, ${contributions.homework}, ${contributions.midterm}, ${contributions.final},
      ${contributions.attendance}, ${contributions.project}, ${contributions.classroom}, ${contributions.engagement},
      ${total}, ${letterGrade}, ${notes}, ${isLocked},
      true
    )
    ON CONFLICT (student_id, session)
    DO UPDATE SET
      quiz_score = EXCLUDED.quiz_score,
      homework_score = EXCLUDED.homework_score,
      midterm_score = EXCLUDED.midterm_score,
      final_score = EXCLUDED.final_score,
      attendance_score = EXCLUDED.attendance_score,
      project_score = EXCLUDED.project_score,
      classroom_score = EXCLUDED.classroom_score,
      engagement_credits = EXCLUDED.engagement_credits,
      quiz_contribution = EXCLUDED.quiz_contribution,
      homework_contribution = EXCLUDED.homework_contribution,
      midterm_contribution = EXCLUDED.midterm_contribution,
      final_contribution = EXCLUDED.final_contribution,
      attendance_contribution = EXCLUDED.attendance_contribution,
      project_contribution = EXCLUDED.project_contribution,
      classroom_contribution = EXCLUDED.classroom_contribution,
      engagement_contribution = EXCLUDED.engagement_contribution,
      total_score = EXCLUDED.total_score,
      letter_grade = EXCLUDED.letter_grade,
      notes = COALESCE(EXCLUDED.notes, student_grades.notes),
      is_locked = EXCLUDED.is_locked,
      attendance_manual_override = true,
      last_calculated_at = CURRENT_TIMESTAMP
    RETURNING *
  `

  return result[0] as Record<string, unknown> | undefined
}

/**
 * GET — Attendance % stored on `student_grades` (manual entry, imports, gradebook).
 * The QR attendance UI lists `attendance_records` only; this endpoint surfaces the other source.
 *
 * Query: section = catalog or filter code (e.g. ELEG1304P01), not "all".
 */
export async function GET(request: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(request)
    if (!attendanceAuth.ok) return attendanceAuth.response

    const instructorId = attendanceAuth.actorId

    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response

    const sectionRaw = request.nextUrl.searchParams.get("section")?.trim() ?? ""
    if (!sectionRaw || sectionRaw.toLowerCase() === "all") {
      return NextResponse.json({ rows: [] })
    }

    const variants = normalizedSectionVariantsForSql(sectionRaw)
    if (variants.length === 0) {
      return NextResponse.json({ rows: [] })
    }

    const scope = await resolveAttendanceInstructorScope(request)

    const rawRows = await loadAttendanceGradebookRowsRaw({
      instructorId,
      sectionRaw,
      courseId: scoped.courseId,
      academicTermId: scope.academicTermId,
      sessionId: scope.sessionId,
    })
    if (rawRows === null) {
      return NextResponse.json({ error: "You do not teach this section" }, { status: 403 })
    }

    return NextResponse.json(
      {
        rows: rawRows.map((r) => mapAttendanceGradebookRow(r)),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    )
  } catch (e: unknown) {
    console.error("[instructor/attendance-gradebook-scores]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load gradebook attendance" },
      { status: 500 },
    )
  }
}

/**
 * PATCH — Set `student_grades.attendance_score` for one student/grade-session row (upsert).
 * Recalculates weighted total and letter grade like POST /api/grades/update.
 *
 * Query: `section` = roster context (e.g. ELEG1304P01); must be a section you teach.
 * Body: { studentId, gradeSession, attendanceScore } — gradeSession is the `student_grades.session` key (often section code or ALL).
 */
export async function PATCH(request: NextRequest) {
  try {
    const attendanceAuth = await requireInstructorAttendanceAccess(request)
    if (!attendanceAuth.ok) return attendanceAuth.response

    const instructorId = attendanceAuth.actorId

    const sectionRaw = request.nextUrl.searchParams.get("section")?.trim() ?? ""
    if (!sectionRaw || sectionRaw.toLowerCase() === "all") {
      return NextResponse.json(
        { error: "Query parameter section is required (pick a section, not All Sections)" },
        { status: 400 },
      )
    }

    const variants = normalizedSectionVariantsForSql(sectionRaw)
    if (variants.length === 0) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 })
    }

    const scoped = await resolveOptionalCourseScope(request)
    if (!scoped.ok) return scoped.response

    const ownsSection = await instructorOwnsSectionVariants(
      instructorId,
      variants,
      scoped.courseId,
    )
    if (!ownsSection) {
      return NextResponse.json({ error: "You do not teach this section" }, { status: 403 })
    }

    const body = await request.json()
    const studentId = Number(body.studentId)
    const gradeSessionRaw = String(body.gradeSession ?? "").trim()
    const attendanceScore = Number(body.attendanceScore)
    const gradeSession = await normalizeSessionForStorage(gradeSessionRaw)

    if (!Number.isFinite(studentId) || studentId <= 0) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 })
    }
    if (!gradeSessionRaw) {
      return NextResponse.json({ error: "gradeSession is required" }, { status: 400 })
    }
    let gradeSessionOk = gradeSessionAllowedForSection(gradeSessionRaw, variants)
    if (!gradeSessionOk) {
      const existingRow = await sql`
        SELECT 1 FROM student_grades sg
        WHERE sg.student_id = ${studentId} AND TRIM(sg.session) = ${gradeSession}
        LIMIT 1
      `
      gradeSessionOk = existingRow.length > 0
    }
    if (!gradeSessionOk) {
      return NextResponse.json(
        { error: "gradeSession must match this section, be ALL, or an existing grade row for this student" },
        { status: 400 },
      )
    }
    if (!Number.isFinite(attendanceScore) || attendanceScore < 0 || attendanceScore > 100) {
      return NextResponse.json(
        { error: "attendanceScore must be a number from 0 to 100" },
        { status: 400 },
      )
    }

    const att = Math.min(100, Math.max(0, attendanceScore))

    const rosterFrag =
      scoped.courseId != null
        ? sql.unsafe(` AND sess.course_id = ${scoped.courseId}`)
        : sql.unsafe("")

    const rosterOk = await sql`
      SELECT 1 AS ok
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id = ${studentId}
        AND (
          TRIM(sess.code) = ANY(${variants}::text[])
          OR TRIM(s.section) = ANY(${variants}::text[])
          OR EXISTS (
            SELECT 1 FROM unnest(${variants}::text[]) AS v(val)
            WHERE val IS NOT NULL
              AND trim(val) <> ''
              AND strpos(upper(trim(coalesce(s.section::text, ''))), upper(trim(val))) > 0
          )
        )
        ${rosterFrag}
      LIMIT 1
    `
    if (rosterOk.length === 0) {
      return NextResponse.json({ error: "Student not found in this section" }, { status: 403 })
    }

    /** Roster canonical section key (matches what Grades Management list prefers over `ALL`). */
    const rosterMeta = await sql`
      SELECT TRIM(COALESCE(sess.code::text, '')) AS code, TRIM(COALESCE(s.section::text, '')) AS section
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.id = ${studentId}
      LIMIT 1
    `
    const rosterCode = String(rosterMeta[0]?.code ?? "").trim()
    const rosterSection = String(rosterMeta[0]?.section ?? "").trim()
    const rosterFragment = rosterCode || rosterSection

    /**
     * Long Canvas `students.section` strings normalize to `ALL`, so we only updated the ALL row while
     * Grades UI / this GET prefer the catalog section row. Expand finds embedded codes (e.g. ELEG1304P01).
     */
    const syncSessionSet = new Set<string>()
    syncSessionSet.add(gradeSession)
    if (rosterFragment) {
      const expanded = await expandSessionKeysForGradeLookup(rosterFragment)
      for (const k of expanded) {
        const nk = await normalizeSessionForStorage(String(k ?? "").trim())
        if (nk !== "ALL") syncSessionSet.add(nk)
      }
    }

    const targetSessions = [
      gradeSession,
      ...[...syncSessionSet].filter((s) => s !== gradeSession),
    ]

    let primaryRow: Record<string, unknown> | undefined
    const syncedSessions: string[] = []

    for (const target of targetSessions) {
      const allowed = await patchTargetAllowed(target, variants, studentId)
      if (!allowed) {
        if (target === gradeSession) {
          return NextResponse.json(
            { error: "gradeSession must match this section, be ALL, or an existing grade row for this student" },
            { status: 400 },
          )
        }
        continue
      }

      const row = await upsertManualAttendanceForSession({
        studentId,
        targetSession: target,
        attendance: att,
      })

      if (!row) {
        if (target === gradeSession) {
          return NextResponse.json(
            {
              error:
                "Grade weights not found for this grade session. Configure grade_weights (or ALL) first.",
            },
            { status: 400 },
          )
        }
        continue
      }

      syncedSessions.push(target)
      if (target === gradeSession) primaryRow = row
    }

    if (!primaryRow) {
      return NextResponse.json({ error: "Failed to save gradebook attendance" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      grade: primaryRow,
      attendanceScore: att,
      syncedSessions,
    })
  } catch (e: unknown) {
    console.error("[instructor/attendance-gradebook-scores PATCH]", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save gradebook attendance" },
      { status: 500 },
    )
  }
}
