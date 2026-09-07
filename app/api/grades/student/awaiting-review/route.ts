import { NextRequest, NextResponse } from "next/server"
import { requireStudentRecordAccess } from "@/lib/student-api-auth"
import { fetchAwaitingReviewAssessments } from "@/lib/student-grade-category-details"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId")
    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const auth = await requireStudentRecordAccess(request, studentId)
    if (!auth.ok) return auth.response

    const items = await fetchAwaitingReviewAssessments(auth.studentDbId)
    return NextResponse.json({ items, count: items.length })
  } catch (error) {
    console.error("[grades/student/awaiting-review]", error)
    return NextResponse.json({ error: "Failed to load awaiting review grades" }, { status: 500 })
  }
}
