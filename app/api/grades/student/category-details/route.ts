import { NextRequest, NextResponse } from "next/server"
import { requireStudentRecordAccess } from "@/lib/student-api-auth"
import {
  fetchStudentGradeCategoryDetails,
  parseGradeCategoryKey,
} from "@/lib/student-grade-category-details"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const session = searchParams.get("session") || "ALL"
    const category = parseGradeCategoryKey(searchParams.get("category"))

    if (!studentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }
    if (!category) {
      return NextResponse.json({ error: "Valid category is required" }, { status: 400 })
    }

    const auth = await requireStudentRecordAccess(request, studentId)
    if (!auth.ok) return auth.response

    const details = await fetchStudentGradeCategoryDetails({
      studentDbId: auth.studentDbId,
      session,
      category,
    })

    return NextResponse.json({ success: true, details })
  } catch (error) {
    console.error("Error fetching grade category details:", error)
    return NextResponse.json({ error: "Failed to fetch category details" }, { status: 500 })
  }
}
