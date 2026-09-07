import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { rejectAccessRequest } from "@/lib/access-governance/service"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAccessGovernanceSchema()
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const { id } = await params
    const { reason } = await request.json()

    await rejectAccessRequest({
      requestId: Number(id),
      reviewer: {
        role: "faculty",
        instructorId: scope.instructorId,
        courseId: scope.course.id,
        isActive: true,
      },
      reason,
    })

    return NextResponse.json({
      success: true,
      message: "Account request rejected successfully",
    })
  } catch (error) {
    console.error("[Account Rejection] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to reject account request"
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 403 })
  }
}
