import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier, getPlaygroundCredits, hasActiveDonationTrial } from "@/lib/membership"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response
    const studentDatabaseId = auth.studentDbId
    
    // Get current membership tier from database
    const tier = await getEffectiveMembershipTier(studentDatabaseId)
    
    // Sync weekly playground allowance (Scholar/Explorer get PLAYGROUND_WEEKLY_CREDITS per week)
    const playgroundCredits = await getPlaygroundCredits(studentDatabaseId)
    
    // Check if student has active donation
    const hasDonationAccess = await hasActiveDonationTrial(studentDatabaseId)
    
    // Get student info
    const student = await sql`
      SELECT id, student_id, full_name, email, membership_tier
      FROM students
      WHERE id = ${studentDatabaseId}
      LIMIT 1
    `
    
    if (student.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({
      tier,
      hasDonationAccess,
      playgroundCredits,
      membership_tier: student[0].membership_tier,
      student_id: student[0].student_id,
      full_name: student[0].full_name,
    })
  } catch (error) {
    console.error("[Membership Refresh] Error:", error)
    return NextResponse.json({ error: "Failed to refresh membership" }, { status: 500 })
  }
}

