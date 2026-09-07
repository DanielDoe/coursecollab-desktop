import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"



export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("student_id")

    if (!studentId) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 })
    }

    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const students = await sql`
      SELECT
        s.id,
        s.student_id,
        s.full_name,
        s.section,
        s.has_changed_password,
        s.membership_tier,
        s.beta_user,
        s.trial_start_date,
        s.course_id,
        c.course_code,
        c.course_title
      FROM students s
      LEFT JOIN courses c ON c.id = s.course_id
      WHERE s.id = ${auth.studentDbId}
    `

    if (students.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const student = students[0]
    
    // Check if this is demo student - demo student has unlimited Trailblazer access, not trial
    const isDemoStudent = student.student_id === "DEMO001" || 
                          student.section === "BETA" || 
                          student.beta_user === true
    
    // Get effective membership tier (Trailblazer for beta users, trial users, and donors)
    const effectiveTier = await getEffectiveMembershipTier(student.id)
    
    // Calculate trial days remaining (but not for demo student - demo has unlimited access)
    let trialDaysRemaining = 0
    let hasActiveTrial = false
    if (!isDemoStudent && student.trial_start_date) {
      const trialStart = new Date(student.trial_start_date)
      const now = new Date()
      const daysSinceTrialStart = Math.floor((now.getTime() - trialStart.getTime()) / (1000 * 60 * 60 * 24))
      trialDaysRemaining = Math.max(0, 7 - daysSinceTrialStart)
      hasActiveTrial = daysSinceTrialStart <= 7
    }

    return NextResponse.json({
      student: {
        ...student,
        membership_tier: effectiveTier, // Return effective tier (Trailblazer for beta users, trial users, and donors)
      },
      has_changed_password: student.has_changed_password,
      trial: isDemoStudent ? null : {
        hasActiveTrial,
        daysRemaining: trialDaysRemaining,
        trialStartDate: student.trial_start_date,
      },
    })
  } catch (error) {
    console.error("[v0] Failed to fetch student info:", error)
    return NextResponse.json({ error: "Failed to fetch student info" }, { status: 500 })
  }
}
