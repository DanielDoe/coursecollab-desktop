import { type NextRequest, NextResponse } from "next/server"
import { removeCourseFromTerm } from "@/lib/academic-term-courses"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest,
  { params }: { params: Promise<{ id: string; courseId: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, courseId: courseIdParam } = await params
    const termId = Number.parseInt(id, 10)
    const courseId = Number.parseInt(courseIdParam, 10)

    try {
      const removed = await removeCourseFromTerm(termId, courseId)
      if (!removed) {
        return NextResponse.json({ error: "Course offering not found in this term" }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove course"
      return NextResponse.json({ error: message }, { status: 400 })
    }
  } catch (error) {
    console.error("[admin/academic-terms/courses DELETE]", error)
    return NextResponse.json({ error: "Failed to remove course from term" }, { status: 500 })
  }
}
