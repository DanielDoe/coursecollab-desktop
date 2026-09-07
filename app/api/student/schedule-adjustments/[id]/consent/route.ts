import { type NextRequest, NextResponse } from "next/server"
import { resolveStudentCourseContextFromRequest } from "@/lib/student-course-scope"
import { requireStudentIdParamMatchesCaller } from "@/lib/student-api-auth"
import { assertStudentCanAccessRequest, submitStudentConsent } from "@/lib/schedule-adjustment/workflow-service"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get("studentId")
    const auth = await requireStudentIdParamMatchesCaller(request, studentId)
    if (!auth.ok) return auth.response

    const resolved = await resolveStudentCourseContextFromRequest(request)
    if (!resolved.ok) return resolved.response

    const { id } = await context.params
    try {
      await assertStudentCanAccessRequest({
        requestId: Number(id),
        studentDbId: resolved.ctx.studentDbId,
        courseId: resolved.ctx.courseId,
      })
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const body = await request.json()

    await submitStudentConsent({
      requestId: Number(id),
      studentId: resolved.ctx.studentDbId,
      agreed: body.agreed === true,
      acknowledged: body.acknowledged === true,
      signatureName: body.signatureName,
      declineReason: body.declineReason,
      declineCategory: body.declineCategory,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Student consent POST]", error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to submit consent" },
      { status: 400 },
    )
  }
}
