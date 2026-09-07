import { type NextRequest, NextResponse } from "next/server"
import { getBaseUrl } from "@/lib/get-base-url"
import { requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

/**
 * Admin re-evaluate mid-semester exam.
 * Proxies to instructor re-evaluate-mid-semesters with examId.
 * Uses quiz_id from quizzes table (assessment_type='mid_semester').
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const examId = id

    if (!examId) {
      return NextResponse.json({ error: "Exam ID is required" }, { status: 400 })
    }

    const baseUrl = getBaseUrl(new URL(request.url).origin)
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response
    const adminId = admin.adminId

    const response = await fetch(
      `${baseUrl}/api/instructor/re-evaluate-mid-semesters?examId=${examId}`,
      {
        method: "POST",
        headers: {
          "x-admin-id": adminId,
          "Content-Type": "application/json",
        },
      }
    )

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Re-evaluation failed" },
        { status: response.status }
      )
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("[Admin Mid-Semester Re-evaluate] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to re-evaluate exam" },
      { status: 500 }
    )
  }
}
