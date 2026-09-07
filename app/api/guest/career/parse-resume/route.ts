import { type NextRequest, NextResponse } from "next/server"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { isAllowedGuestResumeFile } from "@/lib/guest/career/resume-file"
import { extractResumeText } from "@/lib/guest/career/extract-resume-text"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

/** Extract text from an uploaded résumé file (PDF or .txt) without persisting it. */
export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const studentDatabaseId = String(form.get("studentDatabaseId") ?? "").trim()
    const auth = await requireGuestCareerGuest(request, { studentDatabaseId })
    if (auth instanceof NextResponse) return auth

    const file = form.get("file") as File | null
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Upload a résumé file." }, { status: 400 })
    }

    const allowed = isAllowedGuestResumeFile({ name: file.name, type: file.type, size: file.size })
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.error }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await extractResumeText({
      buffer,
      mime: file.type || "",
      fileName: file.name,
    })

    if (!text) {
      return NextResponse.json({
        text: "",
        fileName: file.name,
        warning:
          "Could not read text from this file — it may be a scanned image or Word doc. Paste the text instead.",
      })
    }

    return NextResponse.json({ text, fileName: file.name })
  } catch (e) {
    console.error("[guest/career/parse-resume POST]", e)
    return NextResponse.json({ error: "Failed to read résumé" }, { status: 500 })
  }
}
