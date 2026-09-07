import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const examId = Number.parseInt(params.id)

    const results = await sql`
      SELECT 
        msa.id as attempt_id,
        msa.student_id,
        s.name as student_name,
        s.email as student_email,
        msa.score,
        msa.total_questions,
        msa.percentage,
        msa.completed_at,
        msa.time_taken,
        msa.attempt_number
      FROM mid_semester_attempts msa
      JOIN students s ON msa.student_id = s.student_id
      WHERE msa.mid_semester_id = ${examId}
        AND msa.status = 'completed'
      ORDER BY msa.completed_at DESC
    `

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Failed to fetch results:", error)
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 })
  }
}
