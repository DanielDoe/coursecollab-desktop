import { type NextRequest, NextResponse } from "next/server"
import { isHeicMimeOrName } from "@/lib/heic-image"
import { convertHeicBufferToJpeg } from "@/lib/heic-convert-server"
import { toAbsoluteAssetUrl } from "@/lib/vision-image-for-ai"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

function isAllowedSolutionUrl(url: string): boolean {
  const trimmed = (url || "").trim()
  if (!trimmed) return false
  if (trimmed.startsWith("/uploads/quiz-solutions/")) return true
  if (trimmed.startsWith("/uploads/practice-solutions/")) return true
  if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(trimmed)) return true
  return false
}

async function loadImageBytes(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  const trimmed = (url || "").trim()
  if (!trimmed) return null

  try {
    const absolute = toAbsoluteAssetUrl(trimmed)
    const res = await fetch(absolute, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg"
    return { buf, mime }
  } catch {
    return null
  }
}

/**
 * GET /api/solution-image?url=...
 * Serves JPEG for HEIC/HEIF uploads so faculty previews and legacy files display in browsers.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim()
  if (!url || !isAllowedSolutionUrl(url)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 })
  }

  const loaded = await loadImageBytes(url)
  if (!loaded) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 })
  }

  let { buf, mime } = loaded
  if (isHeicMimeOrName(mime, url)) {
    try {
      buf = await convertHeicBufferToJpeg(buf)
      mime = "image/jpeg"
    } catch (e) {
      console.error("[solution-image] HEIC convert failed:", e)
      return NextResponse.json({ error: "Could not convert HEIC image" }, { status: 422 })
    }
  } else if (!mime.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 400 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400, immutable",
    },
  })
}
