import { type NextRequest, NextResponse } from "next/server"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { requireGuestCareerGuest } from "@/lib/guest/career/require-career-access"
import { careerAccessMeta, gateCareerAnalysis, careerAnalysisIssueCounts } from "@/lib/guest/career/preview-gate"
import { getGuestMasterResume, listGuestResumes, upsertGuestMasterResume } from "@/lib/guest/career/store"
import { isAllowedGuestResumeFile } from "@/lib/guest/career/resume-file"
import { extractResumeText } from "@/lib/guest/career/extract-resume-text"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGuestCareerGuest(request)
    if (auth instanceof NextResponse) return auth
    const resumes = await listGuestResumes(auth.guestId)
    const master = await getGuestMasterResume(auth.guestId)
    return NextResponse.json({ ...careerAccessMeta(auth.accessTier), resumes, masterResume: master })
  } catch (e) {
    console.error("[guest/career/resumes GET]", e)
    return NextResponse.json({ error: "Failed to load résumés" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? ""
    if (contentType.includes("multipart/form-data")) {
      const authRaw = new URL(request.url).searchParams.get("studentDatabaseId") ?? ""
      const form = await request.formData()
      const studentDatabaseId = String(form.get("studentDatabaseId") ?? authRaw).trim()
      const auth = await requireGuestCareerGuest(request, { studentDatabaseId })
      if (auth instanceof NextResponse) return auth

      let parsedText = String(form.get("parsedText") ?? "").trim()
      const file = form.get("file") as File | null
      let originalFileName: string | null = null
      let originalFileUrl: string | null = null
      let originalMime: string | null = null

      if (file && file.size > 0) {
        originalFileName = file.name
        originalMime = file.type || "application/octet-stream"
        const allowed = isAllowedGuestResumeFile({ name: file.name, type: file.type, size: file.size })
        if (!allowed.ok) {
          return NextResponse.json({ error: allowed.error }, { status: 400 })
        }
        const ext = (file.name.split(".").pop() || "bin").toLowerCase()
        const buf = Buffer.from(await file.arrayBuffer())
        if (!parsedText) {
          parsedText = await extractResumeText({
            buffer: buf,
            mime: originalMime,
            fileName: file.name,
          })
        }
        const relativePublicPath = `uploads/guest-career/${auth.guestId}/resume-${Date.now()}.${ext}`
        originalFileUrl = await savePublicUpload({
          blobKey: relativePublicPath,
          relativePublicPath,
          bytes: buf,
          contentType: originalMime,
        })
      }

      if (!parsedText && !originalFileUrl && !originalFileName) {
        return NextResponse.json({ error: "Upload a résumé file or paste text." }, { status: 400 })
      }

      const resume = await upsertGuestMasterResume({
        guestId: auth.guestId,
        parsedText,
        originalFileName,
        originalFileUrl,
        originalMime,
      })
      return NextResponse.json({ resume })
    }

    const body = await request.json()
    const auth = await requireGuestCareerGuest(request, body)
    if (auth instanceof NextResponse) return auth

    const parsedText = String(body.parsedText ?? "").trim()
    if (!parsedText) {
      return NextResponse.json({ error: "parsedText is required" }, { status: 400 })
    }

    const resume = await upsertGuestMasterResume({
      guestId: auth.guestId,
      parsedText,
      label: body.label ? String(body.label) : undefined,
    })
    return NextResponse.json({ resume })
  } catch (e) {
    console.error("[guest/career/resumes POST]", e)
    return NextResponse.json({ error: "Failed to save résumé" }, { status: 500 })
  }
}
