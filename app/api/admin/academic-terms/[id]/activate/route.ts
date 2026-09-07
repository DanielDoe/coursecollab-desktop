import { type NextRequest, NextResponse } from "next/server"
import { setActiveAcademicTerm, formatAcademicTermLabel } from "@/lib/active-academic-term"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

/** Mark one academic term as active (governs student login). */
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
    console.error("[admin/academic-terms activate]", error)
    return NextResponse.json({ error: "Failed to set active academic term" }, { status: 500 })
  }
}
