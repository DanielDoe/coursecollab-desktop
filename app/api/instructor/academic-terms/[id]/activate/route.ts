import { type NextRequest, NextResponse } from "next/server"
import { setActiveAcademicTerm, formatAcademicTermLabel } from "@/lib/active-academic-term"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"

export const dynamic = "force-dynamic"

/** Mark one academic term as active (governs student login). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) {
      return scope.response
    }

    const { id } = await params
    const termId = Number.parseInt(id, 10)
    if (!Number.isFinite(termId)) {
      return NextResponse.json({ error: "Invalid term id" }, { status: 400 })
    }

    const term = await setActiveAcademicTerm(termId)
    if (!term) {
      return NextResponse.json({ error: "Academic term not found" }, { status: 404 })
    }

    return NextResponse.json({
      term,
      label: formatAcademicTermLabel(term.year, term.term),
    })
  } catch (error) {
    console.error("[instructor/academic-terms activate]", error)
    return NextResponse.json({ error: "Failed to set active academic term" }, { status: 500 })
  }
}
