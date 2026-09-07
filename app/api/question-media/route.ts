import { type NextRequest, NextResponse } from "next/server"
import { isAllowedQuestionMediaUrl, normalizeQuestionMediaPath } from "@/lib/question-media-proxy"
import { fetchStoredAssetBytes } from "@/lib/resolve-stored-asset"
import { logMissingAsset } from "@/lib/asset-failure-log"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

async function loadMediaBytes(
  url: string,
  requestOrigin?: string | null,
): Promise<{ buf: Buffer; mime: string } | null> {
  const trimmed = (url || "").trim()
  if (!trimmed) return null

  try {
    const buf = await fetchStoredAssetBytes(trimmed, requestOrigin)
    if (!buf?.length) return null
    const lower = trimmed.toLowerCase().split("?")[0] ?? trimmed
    const mime = lower.endsWith(".pdf")
      ? "application/pdf"
      : lower.endsWith(".svg")
        ? "image/svg+xml"
        : lower.endsWith(".png")
          ? "image/png"
          : lower.endsWith(".webp")
            ? "image/webp"
            : lower.endsWith(".gif")
              ? "image/gif"
              : "image/jpeg"
    return { buf, mime }
  } catch {
    return null
  }
}

/**
 * GET /api/question-media?url=...
 * Same-origin proxy for exam circuit diagrams (Vercel Blob + public uploads).
 */
export async function GET(request: NextRequest) {
  const url = normalizeQuestionMediaPath(request.nextUrl.searchParams.get("url")?.trim() || "")
  if (!url || !isAllowedQuestionMediaUrl(url)) {
    return NextResponse.json({ error: "Invalid media URL" }, { status: 400 })
  }

  const loaded = await loadMediaBytes(url, request.nextUrl.origin)
  if (!loaded) {
    void logMissingAsset({
      assetUrl: url,
      httpStatus: 404,
      moduleName: "Exam Module",
      featureName: "Question media proxy",
      route: "/api/question-media",
    })
    return NextResponse.json({ error: "Media not found" }, { status: 404 })
  }

  const { buf, mime } = loaded
  const isPdf = mime.includes("pdf") || url.toLowerCase().split("?")[0].endsWith(".pdf")
  if (!isPdf && !mime.startsWith("image/") && mime !== "image/svg+xml") {
    return NextResponse.json({ error: "Unsupported media type" }, { status: 400 })
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": isPdf ? "application/pdf" : mime,
      "Cache-Control": "public, max-age=3600, must-revalidate",
    },
  })
}
