import { type NextRequest, NextResponse } from "next/server"
import { addCourseToTerm, listTermCourses, removeCourseFromTerm } from "@/lib/academic-term-courses"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    const courses = await listTermCourses(termId)
    return NextResponse.json({ courses })
  } catch (error) {
    console.error("[admin/academic-terms/courses GET]", error)
    return NextResponse.json({ error: "Failed to fetch term courses" }, { status: 500 })
  }
}

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    const { course_id } = await request.json()
    const courseId = Number(course_id)

    const offering = await addCourseToTerm(termId, courseId)
    if (!offering) {
      return NextResponse.json({ error: "Academic term or course not found" }, { status: 404 })
    }

    return NextResponse.json({ course: offering })
  } catch (error) {
    console.error("[admin/academic-terms/courses POST]", error)
    return NextResponse.json({ error: "Failed to add course to term" }, { status: 500 })
  }
}
