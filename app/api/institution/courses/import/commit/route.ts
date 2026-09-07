import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { requirePortalPermission } from "@/lib/institutions/portal/api-helpers"
import { commitImsccImport } from "@/lib/imscc/commit"
import type { ImsccCatalog } from "@/lib/imscc/types"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "manage_courses")) {
    return NextResponse.json({ error: "Not authorized to import courses" }, { status: 403 })
  }

  try {
    const body = (await request.json()) as {
      catalog?: ImsccCatalog
      selectedIds?: string[]
      courseCode?: string
      courseTitle?: string
      description?: string | null
      instructorId?: number
    }

    if (!body.catalog?.info || !Array.isArray(body.catalog.items)) {
      return NextResponse.json({ error: "Missing parsed catalog" }, { status: 400 })
    }
    if (!body.courseCode?.trim() || !body.courseTitle?.trim()) {
      return NextResponse.json({ error: "Course code and title are required" }, { status: 400 })
    }

    let instructorId = Number(body.instructorId)
    if (!Number.isFinite(instructorId) || instructorId < 1) {
      if (auth.session.userType === "instructor" && auth.session.userId > 0) {
        instructorId = auth.session.userId
      }
    }
    if (!Number.isFinite(instructorId) || instructorId < 1) {
      return NextResponse.json({ error: "Select a faculty owner for the imported course" }, { status: 400 })
    }

    const member = await sql`
      SELECT 1 FROM institution_members
      WHERE institution_id = ${auth.session.institutionId}
        AND user_type = 'instructor'
        AND user_id = ${instructorId}
        AND removed_at IS NULL
      LIMIT 1
    `
    if (member.length === 0) {
      return NextResponse.json({ error: "That instructor is not on this institution license" }, { status: 403 })
    }

    const result = await commitImsccImport({
      instructorId,
      catalog: body.catalog,
      selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds : [],
      courseCode: body.courseCode,
      courseTitle: body.courseTitle,
      description: body.description ?? null,
      university: auth.session.institutionName,
      universityId: auth.session.institutionId,
      attachToActiveLicense: true,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed"
    const status = message.includes("already have") ? 409 : 400
    console.error("[institution/courses/import/commit]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
