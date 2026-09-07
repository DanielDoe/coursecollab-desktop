import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { requireInstructorSession } from "@/lib/instructor-session-auth"
import { syncActivityPoints } from "@/lib/trade-center-sync"
import { normalizeSessionForStorage } from "@/lib/session-catalog"
import { markPlaygroundResultComplete } from "@/lib/playground-result-complete"

export const dynamic = "force-dynamic"

/**
 * Admin endpoint to manually sync playground points to trade center
 * Can sync for a specific student or all students with playground results
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const auth = await requireInstructorSession(request)
    if (!auth.ok) return auth.response

    const body = await request.json()
    const { studentId, studentDbId, fixCompletedAt = true } = body

    // If studentId (string) or studentDbId (number) is provided, sync for that student
    if (studentId || studentDbId) {
      let dbId: number
      let studentIdString: string

      if (studentDbId) {
        dbId = parseInt(studentDbId)
        const student = await sql`
          SELECT student_id, section FROM students WHERE id = ${dbId} LIMIT 1
        `
        if (student.length === 0) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }
        studentIdString = student[0].student_id
      } else {
        studentIdString = studentId
        const student = await sql`
          SELECT id, section FROM students WHERE student_id = ${studentIdString} LIMIT 1
        `
        if (student.length === 0) {
          return NextResponse.json({ error: "Student not found" }, { status: 404 })
        }
        dbId = student[0].id
      }

      // Fix completed_at for playground results if needed
      // Only update if completed_at is NULL (don't try to compare with created_at which may not exist)
      if (fixCompletedAt) {
        const fixed = await markPlaygroundResultComplete(0, { byStudentId: studentIdString })
        console.log(`[Admin Sync] Fixed ${fixed.length} playground results for ${studentIdString}`)
      }

      const student = await sql`
        SELECT section FROM students WHERE id = ${dbId} LIMIT 1
      `
      const session = normalizeActivityPointsSession(String(student[0]?.section || "ALL"))

      // Trigger sync
      const syncResult = await syncActivityPoints(dbId, session)

      return NextResponse.json({
        success: true,
        studentId: studentIdString,
        studentDbId: dbId,
        session,
        syncResult,
      })
    }

    // If no student specified, sync all students with playground results from current week
    const weekResult = await sql`
      SELECT DATE_TRUNC('week', CURRENT_DATE)::date as week_start
    `
    const weekStart = weekResult[0]?.week_start

    const studentsWithResults = await sql`
      SELECT DISTINCT 
        s.id as db_id,
        s.student_id,
        s.full_name,
        s.section
      FROM students s
      INNER JOIN playground_results pr ON pr.student_id = s.student_id
      WHERE pr.score > 0
        AND pr.questions_answered > 0
        AND DATE_TRUNC('week', COALESCE(pr.completed_at, CURRENT_TIMESTAMP))::date = ${weekStart}::date
      LIMIT 100
    `

    const results = []
    for (const student of studentsWithResults) {
      try {
        // Fix completed_at if needed
        if (fixCompletedAt) {
          await markPlaygroundResultComplete(0, { byStudentId: student.student_id })
        }

        const session = await normalizeSessionForStorage(String(student.section || "ALL"))
        const syncResult = await syncActivityPoints(student.db_id, session)

        results.push({
          studentId: student.student_id,
          studentName: student.full_name,
          success: true,
          syncResult,
        })
      } catch (error: any) {
        results.push({
          studentId: student.student_id,
          studentName: student.full_name,
          success: false,
          error: error.message,
        })
      }
    }

    return NextResponse.json({
      success: true,
      synced: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    })
  } catch (error: any) {
    console.error("[Admin Sync] Error:", error)
    return NextResponse.json(
      { error: "Failed to sync playground points", details: error.message },
      { status: 500 }
    )
  }
}

