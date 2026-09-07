import { type NextRequest, NextResponse } from "next/server"
import { commitImsccImport } from "@/lib/imscc/commit"
import type { ImsccCatalog } from "@/lib/imscc/types"
import { requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      catalog?: ImsccCatalog
      selectedIds?: string[]
      courseCode?: string
      courseTitle?: string
      description?: string | null
    }

    if (!body.catalog?.info || !Array.isArray(body.catalog.items)) {
      return NextResponse.json({ error: "Missing parsed catalog" }, { status: 400 })
    }
    if (!body.courseCode?.trim() || !body.courseTitle?.trim()) {
      return NextResponse.json({ error: "Course code and title are required" }, { status: 400 })
    }

    const result = await commitImsccImport({
      instructorId: auth.instructorId,
      catalog: body.catalog,
      selectedIds: Array.isArray(body.selectedIds) ? body.selectedIds : [],
      courseCode: body.courseCode,
      courseTitle: body.courseTitle,
      description: body.description ?? null,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed"
    const status = message.includes("already have") ? 409 : 400
    console.error("[instructor/courses/import/commit]", error)
    return NextResponse.json({ error: message }, { status })
  }
}
