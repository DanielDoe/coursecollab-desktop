import { type NextRequest, NextResponse } from "next/server"
import { parseImsccFromBytes } from "@/lib/imscc/parse"
import { requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_UPLOAD = 80 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json({ error: "Upload a Canvas .imscc package" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD) {
      return NextResponse.json(
        {
          error:
            "This package is too large to upload. CourseCollab will parse it in your browser instead — keep the file selected and continue.",
          code: "too_large",
        },
        { status: 413 },
      )
    }
    const name = file.name.toLowerCase()
    if (!name.endsWith(".imscc") && !name.endsWith(".zip")) {
      return NextResponse.json({ error: "File must be a Canvas Common Cartridge (.imscc)" }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const catalog = await parseImsccFromBytes(bytes)
    return NextResponse.json({ catalog })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse package"
    console.error("[instructor/courses/import/analyze]", error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
