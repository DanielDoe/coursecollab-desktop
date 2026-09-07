import { type NextRequest, NextResponse } from "next/server"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { fetchStudentPlatformRecord } from "@/lib/student-platform-record"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Admin ID required" }, { status: 400 })
    }

    const { id } = await params
    const studentDbId = Number(id)
    if (!Number.isFinite(studentDbId) || studentDbId <= 0) {
      return NextResponse.json({ error: "Invalid student id" }, { status: 400 })
    }

    const courseIdRaw = request.nextUrl.searchParams.get("course_id")
    const courseId = courseIdRaw ? Number(courseIdRaw) : null

    const record = await fetchStudentPlatformRecord(
      studentDbId,
      courseId != null && Number.isFinite(courseId) ? courseId : null,
    )
    if (!record) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, record })
  } catch (error) {
    console.error("[admin/students/record]", error)
    return NextResponse.json({ error: "Failed to load student record" }, { status: 500 })
  }
}
