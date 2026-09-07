import { type NextRequest, NextResponse } from "next/server"
import { getActiveAcademicTerm } from "@/lib/active-academic-term"
import { getSessionCatalogFromDb } from "@/lib/session-catalog"
import { isLegacyLoginRequest, requireStudentApiAuth } from "@/lib/require-student-api-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 10

/**
 * GET sessions — authenticated students only (legacy login header for deprecated form).
 */
export async function GET(request: NextRequest) {
  try {
    if (!isLegacyLoginRequest(request)) {
      const auth = await requireStudentApiAuth(request)
      if (auth instanceof NextResponse) return auth
    }
    const courseIdRaw = new URL(request.url).searchParams.get("courseId")
    const courseId = courseIdRaw ? Number(courseIdRaw) : null
    const activeTerm = await getActiveAcademicTerm()
    const entries = await getSessionCatalogFromDb({
      courseId: courseId != null && Number.isFinite(courseId) ? courseId : undefined,
      academicTermId: activeTerm?.id ?? undefined,
    })
    // Omit BETA pseudo-sections: beta testers use real lecture rows with `students.beta_user = true`.
    const sessions = entries
      .filter((e) => String(e.code).trim().toUpperCase() !== "BETA")
      .map((e) => ({
        id: e.id,
        code: e.code,
      }))

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error("[v0] Failed to fetch sessions:", error)
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 })
  }
}
