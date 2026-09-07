import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  checkStudentRecordDeleteAllowed,
  logStudentDataDeleteAudit,
  studentDataDeleteGuardResponse,
} from "@/lib/student-data-protection"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { session_id, confirmPhrase } = await request.json()

    if (!session_id) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const countResult = await sql`
      SELECT COUNT(*)::int AS count FROM students WHERE session_id = ${session_id}
    `
    const studentCount = Number(countResult[0]?.count ?? 0)

    const guard = checkStudentRecordDeleteAllowed({
      bulk: true,
      confirmPhrase,
      affectedRowEstimate: studentCount,
      operation: "Bulk delete students by session",
    })
    if (guard.blocked) return studentDataDeleteGuardResponse(guard)

    await sql`DELETE FROM students WHERE session_id = ${session_id}`

    await logStudentDataDeleteAudit({
      source: "api:instructor/students/bulk-delete",
      actorType: "instructor",
      entityType: "students",
      metadata: { session_id, deletedCount: studentCount },
    })

    return NextResponse.json({
      message: "Students deleted successfully",
      deletedCount: studentCount,
    })
  } catch (error) {
    console.error("[v0] Failed to bulk delete students:", error)
    return NextResponse.json({ error: "Failed to delete students" }, { status: 500 })
  }
}
