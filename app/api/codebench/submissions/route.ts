import { NextRequest, NextResponse } from "next/server"
import { requireCodebenchStudent } from "@/lib/codebench-request-auth"
import { sql } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const auth = await requireCodebenchStudent(request, searchParams.get("studentId"))
    if (!auth.ok) return auth.response

    const submissions = await sql`
      SELECT 
        id,
        code,
        score,
        points_awarded,
        feedback,
        status,
        submitted_at
      FROM codebench_submissions
      WHERE student_id = ${auth.studentDbId}
      ORDER BY submitted_at DESC
      LIMIT 20
    `

    const practiceSubmissions = await sql`
      SELECT 
        id,
        problem as problem_statement,
        code,
        score,
        points_awarded,
        feedback,
        detailed_feedback,
        status,
        submitted_at
      FROM practice_submissions
      WHERE student_id = ${auth.studentDbId}
      ORDER BY submitted_at DESC
      LIMIT 20
    `

    const dailyChallengeSubmissions = await sql`
      SELECT 
        id,
        challenge_title,
        challenge_description,
        code,
        score,
        points_awarded,
        feedback,
        detailed_feedback,
        status,
        submitted_at
      FROM daily_challenge_submissions
      WHERE student_id = ${auth.studentDbId}
      ORDER BY submitted_at DESC
      LIMIT 20
    `

    return NextResponse.json({
      codeSubmissions: submissions,
      practiceSubmissions: practiceSubmissions,
      dailyChallengeSubmissions: dailyChallengeSubmissions,
    })
  } catch (error) {
    console.error("Submissions fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 })
  }
}
