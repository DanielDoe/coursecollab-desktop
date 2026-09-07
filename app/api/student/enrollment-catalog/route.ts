import { type NextRequest, NextResponse } from "next/server"
import { getStudentEnrollmentCatalog } from "@/lib/student-enrollment-catalog"

export const dynamic = "force-dynamic"

/** Public catalog of enrollable courses/sections for a university (student self-signup). */
export async function GET(request: NextRequest) {
  try {
    const universityId = Number(request.nextUrl.searchParams.get("universityId"))
    if (!Number.isFinite(universityId) || universityId <= 0) {
      return NextResponse.json({ error: "universityId is required." }, { status: 400 })
    }

    const catalog = await getStudentEnrollmentCatalog(universityId)
    return NextResponse.json(catalog)
  } catch (error) {
    console.error("[student/enrollment-catalog]", error)
    return NextResponse.json({ error: "Failed to load enrollment catalog", courses: [] }, { status: 500 })
  }
}
