import { NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const result = await sql`
      SELECT id, student_id, full_name, section, email
      FROM students
      WHERE id = ${studentId}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = result[0]
    return NextResponse.json({
      success: true,
      student,
      profile: student,
    })
  } catch (error) {
    console.error("[v0] Error fetching student profile:", error)
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { studentId, fullName, email, studentIdCode } = body

    // Validate input - studentId is the database id (students.id)
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const dbId = typeof studentId === "string" ? parseInt(studentId, 10) : Number(studentId)
    if (isNaN(dbId)) {
      return NextResponse.json({ error: "Invalid student ID" }, { status: 400 })
    }

    // Parse and validate fields (only update if key present in body)
    const hasFullName = "fullName" in body
    const fullNameVal = hasFullName && fullName != null && String(fullName).trim() ? String(fullName).trim() : null
    if (hasFullName && fullNameVal && fullNameVal.length < 2) {
      return NextResponse.json({ error: "Please enter a valid full name (at least 2 characters)" }, { status: 400 })
    }

    const hasEmail = "email" in body
    const emailVal = hasEmail ? (email != null && String(email).trim() ? String(email).trim() : null) : undefined
    if (hasEmail && emailVal !== null && emailVal !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(emailVal)) {
        return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 })
      }
    }

    const hasStudentIdCode = "studentIdCode" in body
    const studentIdCodeVal = hasStudentIdCode && studentIdCode != null && String(studentIdCode).trim() ? String(studentIdCode).trim() : null
    if (hasStudentIdCode && studentIdCodeVal) {
      if (studentIdCodeVal.length < 1 || studentIdCodeVal.length > 50) {
        return NextResponse.json({ error: "Student ID must be 1-50 characters" }, { status: 400 })
      }
      const existing = await sql`
        SELECT id FROM students
        WHERE student_id = ${studentIdCodeVal}
          AND section = (SELECT section FROM students WHERE id = ${dbId} LIMIT 1)
          AND id != ${dbId}
        LIMIT 1
      `
      if (existing.length > 0) {
        return NextResponse.json({ error: "This Student ID is already in use by another student in your section" }, { status: 400 })
      }
    }

    if (!hasFullName && !hasEmail && !hasStudentIdCode) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    // Fetch current row to merge with updates
    const current = await sql`
      SELECT full_name, email, student_id FROM students WHERE id = ${dbId} LIMIT 1
    `
    if (current.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }
    const cur = current[0]
    const newFullName = hasFullName && fullNameVal ? fullNameVal : cur.full_name
    const newEmail = hasEmail ? (emailVal ?? null) : cur.email
    const newStudentId = hasStudentIdCode ? (studentIdCodeVal || cur.student_id) : cur.student_id

    const updateResult = await sql`
      UPDATE students
      SET full_name = ${newFullName}, email = ${newEmail}, student_id = ${newStudentId}
      WHERE id = ${dbId}
      RETURNING id, student_id, full_name, section, email
    `

    const result = updateResult

    if (result.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = result[0]
    return NextResponse.json({
      success: true,
      student,
      profile: student,
    })
  } catch (error) {
    console.error("[v0] Error updating student profile:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
