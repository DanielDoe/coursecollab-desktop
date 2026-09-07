import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { savePublicUpload } from "@/lib/blob-or-local-public"
import { ensureInstructorRecommendationSettings } from "@/lib/recommendation-letters"
import { requireInstructorSession } from "@/lib/instructor-session-auth"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const session = await requireInstructorSession(request)
    if (!session.ok) return session.response
    const id = session.instructorId

    const formData = await request.formData()
    const assetType = String(formData.get("assetType") ?? formData.get("asset_type") ?? "")
    const file = formData.get("file") as File | null

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 })
    }
    if (assetType !== "logo" && assetType !== "signature") {
      return NextResponse.json({ error: "assetType must be logo or signature" }, { status: 400 })
    }

    const mime = file.type
    if (mime !== "image/png" && mime !== "image/jpeg") {
      return NextResponse.json({ error: "Only PNG or JPEG images are supported" }, { status: 400 })
    }

    await ensureInstructorRecommendationSettings(id)

    const ext = mime === "image/png" ? "png" : "jpg"
    const fname =
      assetType === "signature"
        ? `signature-${Date.now()}.${ext}`
        : `logo-${Date.now()}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const relativePublicPath = `uploads/recommendations/letterhead/${id}/${fname}`
    const url = await savePublicUpload({
      blobKey: relativePublicPath,
      relativePublicPath,
      bytes: buf,
      contentType: mime,
    })

    if (assetType === "signature") {
      await sql`
        UPDATE recommendation_settings
        SET letterhead_signature_image_url = ${url}, updated_at = NOW()
        WHERE instructor_id = ${id}
      `
    } else {
      await sql`
        UPDATE recommendation_settings
        SET letterhead_logo_url = ${url}, updated_at = NOW()
        WHERE instructor_id = ${id}
      `
    }

    return NextResponse.json({ url, assetType })
  } catch (e) {
    console.error("[letterhead upload]", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
