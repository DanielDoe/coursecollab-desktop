import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"
import { requirePortalPermission } from "@/lib/institutions/portal/api-helpers"
import { parseImsccFromBytes } from "@/lib/imscc/parse"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_UPLOAD = 80 * 1024 * 1024

export async function POST(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  if (!requirePortalPermission(auth.session.role, "manage_courses")) {
    return NextResponse.json({ error: "Not authorized to import courses" }, { status: 403 })
  }

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "Upload a Canvas .imscc package" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD) {
      return NextResponse.json(
        {
          error: "Package too large to upload. Parse it in the browser instead.",
          code: "too_large",
        },
        { status: 413 },
      )
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    const catalog = await parseImsccFromBytes(bytes)
    return NextResponse.json({ catalog })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse package"
    console.error("[institution/courses/import/analyze]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
