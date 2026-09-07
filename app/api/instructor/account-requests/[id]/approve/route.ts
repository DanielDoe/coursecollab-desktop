import { NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { approveAccessRequest } from "@/lib/access-governance/service"
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

    const result = await approveAccessRequest({
      requestId: Number(id),
      reviewer: {
        role: "faculty",
        instructorId: scope.instructorId,
        courseId: scope.course.id,
        isActive: true,
      },
      approvalSource: "faculty",
    })

    return NextResponse.json({
      success: true,
      studentId: result.userId,
      message: result.message,
    })
  } catch (error) {
    console.error("[Approve Account] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to approve account request"
    const status =
      message.includes("not found") ? 404 : message.includes("outside") || message.includes("cannot") || message.includes("require") ? 403 : 500
    return NextResponse.json({ error: message, details: message }, { status })
  }
}
