import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"

/** Instructor-style list for dashboard student management. */
async function fetchDashboardStudents(sessionId: string | null) {
  if (sessionId && sessionId !== "all") {
    return sql`
      SELECT
        s.id,
        s.student_id,
        s.full_name,
        s.email,
        s.section,
        s.session_id,
        s.course_id,
        COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
        sess.code as session_code,
        sess.description as session_description,
        (SELECT COUNT(*)::int FROM quiz_attempts qa2 WHERE qa2.student_id = s.id) as quiz_attempts
      FROM students s
      LEFT JOIN sessions sess ON sess.id = s.session_id
      WHERE s.session_id = ${Number(sessionId)}
      ORDER BY s.full_name
    `
  }

  return sql`
    SELECT
      s.id,
      s.student_id,
      s.full_name,
      s.email,
      s.section,
      s.session_id,
      s.course_id,
      COALESCE(s.created_at, CURRENT_TIMESTAMP) as created_at,
      sess.code as session_code,
      sess.description as session_description,
      (SELECT COUNT(*)::int FROM quiz_attempts qa2 WHERE qa2.student_id = s.id) as quiz_attempts
    FROM students s
    LEFT JOIN sessions sess ON sess.id = s.session_id
    ORDER BY s.full_name
  `
}

/** Legacy institutional list (membership / session code filters). */
async function fetchInstitutionalStudents(
  session: string | null,
  membership: string | null,
  status: string | null,
) {
  let query = sql`
    SELECT
      s.*,
      sm.membership_tier,
      COUNT(qa.id) as total_attempts,
      AVG(qa.score) as average_score,
      COUNT(CASE WHEN qa.completed_at IS NOT NULL THEN 1 END) * 100.0 / NULLIF(COUNT(qa.id), 0) as completion_rate,
      SUM(qa.score) as total_points,
      ARRAY_AGG(DISTINCT CASE WHEN qa.score >= 90 THEN 'High Scorer' END) FILTER (WHERE qa.score >= 90) as badges,
      MAX(s.last_login) as last_login
    FROM students s
    LEFT JOIN student_memberships sm ON s.id = sm.student_id
    LEFT JOIN quiz_attempts qa ON s.id = qa.student_id
  `

  const conditions: string[] = []

  if (session && session !== "all") {
    conditions.push(`s.session_code = ${sql.unsafe(`'${session.replace(/'/g, "''")}'`)}`)
  }

  if (membership && membership !== "all") {
    conditions.push(`sm.membership_tier = ${sql.unsafe(`'${membership.replace(/'/g, "''")}'`)}`)
  }

  if (status && status !== "all") {
    if (status === "active") {
      conditions.push(`s.is_active = true`)
    } else if (status === "inactive") {
      conditions.push(`s.is_active = false`)
    }
  }

  if (conditions.length > 0) {
    query = sql`${query} WHERE ${sql.unsafe(conditions.join(" AND "))}`
  }

  query = sql`${query} GROUP BY s.id, sm.membership_tier ORDER BY s.created_at DESC`

  const students = await query

  return students.map((student: Record<string, unknown>) => ({
    id: student.id,
    full_name: student.full_name,
    email: student.email,
    student_number: student.student_number,
    phone: student.phone,
    address: student.address,
    date_of_birth: student.date_of_birth,
    enrollment_date: student.enrollment_date,
    session_code: student.session_code,
    is_active: student.is_active,
    membership_tier: student.membership_tier || "Scholar",
    last_login: student.last_login,
    total_attempts: Number(student.total_attempts || 0),
    average_score: Number(student.average_score || 0),
    completion_rate: Number(student.completion_rate || 0),
    total_points: Number(student.total_points || 0),
    badges: (student.badges as string[] | null)?.filter((badge) => badge !== null) ?? [],
    notes: student.notes,
    created_at: student.created_at,
    updated_at: student.updated_at,
  }))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("session_id")
    const session = searchParams.get("session")
    const membership = searchParams.get("membership")
    const status = searchParams.get("status")

    const useInstitutionalView =
      sessionId == null &&
      (session != null || membership != null || status != null)

    if (useInstitutionalView) {
      const students = await fetchInstitutionalStudents(session, membership, status)
      return NextResponse.json({ students })
    }

    const rows = await fetchDashboardStudents(sessionId)
    const students = rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      student_id: row.student_id,
      full_name: row.full_name,
      email: row.email,
      section: row.section,
      session_id: row.session_id,
      course_id: row.course_id,
      session_code: row.session_code,
      session_description: row.session_description,
      created_at: row.created_at,
      quiz_attempts: Number(row.quiz_attempts ?? 0),
    }))

    return NextResponse.json({ students })
  } catch (error) {
    console.error("Failed to fetch students:", error)
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const body = await request.json()

    // Dashboard roster create (student-management)
    if (body.student_id && body.full_name) {
      const { student_id, full_name, course_id, session_id, email, section } = body
      const courseId = Number(course_id)
      if (!Number.isFinite(courseId)) {
        return NextResponse.json({ error: "Course is required" }, { status: 400 })
      }

      const courseRows = await sql`
        SELECT id, course_code FROM courses WHERE id = ${courseId} AND is_active = true LIMIT 1
      `
      if (courseRows.length === 0) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 })
      }

      let sessionId: number | null = null
      let sectionStored = section?.trim() || String(courseRows[0].course_code ?? "GENERAL")

      if (session_id && session_id !== "none") {
        const sid = Number(session_id)
        const sessRows = await sql`
          SELECT id, code, course_id FROM sessions WHERE id = ${sid} LIMIT 1
        `
        if (sessRows.length === 0) {
          return NextResponse.json({ error: "Section not found" }, { status: 404 })
        }
        const sess = sessRows[0] as { id: number; code: string; course_id: number | null }
        if (sess.course_id != null && sess.course_id !== courseId) {
          return NextResponse.json({ error: "Section does not belong to the selected course" }, { status: 400 })
        }
        sessionId = sess.id
        sectionStored = sess.code
      }

      const dup = await sql`
        SELECT id FROM students WHERE student_id = ${String(student_id).trim()} LIMIT 1
      `
      if (dup.length > 0) {
        return NextResponse.json({ error: "Student ID already exists" }, { status: 409 })
      }

      const { getStudentRosterDefaultPassword } = await import("@/lib/student-roster-default-password")
      const defaultPassword = getStudentRosterDefaultPassword(
        courseRows[0].course_code as string | undefined,
      )

      const inserted = await sql`
        INSERT INTO students (
          student_id, full_name, section, email, password, has_changed_password,
          session_id, course_id
        )
        VALUES (
          ${String(student_id).trim()},
          ${String(full_name).trim()},
          ${sectionStored},
          ${email?.trim() || null},
          ${defaultPassword},
          false,
          ${sessionId},
          ${courseId}
        )
        RETURNING id, student_id, full_name, section, session_id, course_id, created_at
      `

      return NextResponse.json({ student: inserted[0] })
    }

    const {
      full_name,
      email,
      student_number,
      phone,
      address,
      date_of_birth,
      session_code,
      membership_tier,
      password,
    } = body

    const result = await sql`
      INSERT INTO students (
        full_name, email, student_number, phone, address,
        date_of_birth, session_code, is_active, password_hash
      ) VALUES (
        ${full_name}, ${email}, ${student_number}, ${phone || null}, ${address || null},
        ${date_of_birth || null}, ${session_code}, true, ${password}
      ) RETURNING id
    `

    const studentId = result[0].id

    await sql`
      INSERT INTO student_memberships (student_id, membership_tier, start_date, is_active)
      VALUES (${studentId}, ${membership_tier || "Scholar"}, CURRENT_TIMESTAMP, true)
    `

    return NextResponse.json({
      message: "Student created successfully",
      studentId,
    })
  } catch (error) {
    console.error("Failed to create student:", error)
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { studentId, is_active, membership_tier, notes } = body

    const result = await sql`
      UPDATE students
      SET
        is_active = ${is_active},
        notes = ${notes || null},
        updated_at = NOW()
      WHERE id = ${studentId}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (membership_tier) {
      await sql`
        UPDATE student_memberships
        SET membership_tier = ${membership_tier}, updated_at = NOW()
        WHERE student_id = ${studentId}
      `
    }

    return NextResponse.json({
      message: "Student updated successfully",
    })
  } catch (error) {
    console.error("Failed to update student:", error)
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 })
  }
}
