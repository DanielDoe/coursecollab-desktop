import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getStudentCoraBalance } from "@/lib/membership"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    let studentDatabaseId: number
    if (typeof studentId === "string" && isNaN(Number(studentId))) {
      const studentLookup = await sql`
        SELECT id FROM students WHERE student_id = ${studentId} LIMIT 1
      `
      if (studentLookup.length === 0) {
        return NextResponse.json({ error: "Student not found" }, { status: 404 })
      }
      studentDatabaseId = studentLookup[0].id
    } else {
      studentDatabaseId = parseInt(studentId as string)
    }

    const studentExists = await sql`
      SELECT id FROM students WHERE id = ${studentDatabaseId} LIMIT 1
    `
    if (studentExists.length === 0) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    const bal = await getStudentCoraBalance(studentDatabaseId)

    return NextResponse.json({
      credits: bal.total,
      membershipCredits: bal.membershipCredits,
      purchasedCredits: bal.purchasedCredits,
      tier: bal.tier,
      creditsLimit: bal.monthlyAllocation,
      periodKey: bal.periodKey,
      isUnlimited: false,
      isLow: bal.isLow,
      coraMode: bal.mode,
      refresh: "monthly",
    })
  } catch (error) {
    console.error("[v0] Error fetching AI tutor credits:", error)
    return NextResponse.json({ error: "Failed to fetch AI tutor credits" }, { status: 500 })
  }
}
