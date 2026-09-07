import { type NextRequest, NextResponse } from "next/server"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { isVariantSafeSrc, MEDIA_VARIANT_WIDTH } from "@/lib/media/variants"

export const dynamic = "force-dynamic"

const ALLOWED_WIDTHS = new Set(Object.values(MEDIA_VARIANT_WIDTH))

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src") || ""
  const width = Number(request.nextUrl.searchParams.get("w") || MEDIA_VARIANT_WIDTH.thumb)
  if (!src || !isVariantSafeSrc(src) || !ALLOWED_WIDTHS.has(width as 64 | 160 | 480 | 1200)) {
    return NextResponse.json({ error: "Invalid image request" }, { status: 400 })
  }

  const absolute = src.startsWith("http")
    ? src
    : new URL(src, request.nextUrl.origin).toString()

  try {
    const upstream = await fetch(absolute, { cache: "force-cache" })
    if (!upstream.ok) {
      return NextResponse.redirect(absolute)
    }
    const bytes = Buffer.from(await upstream.arrayBuffer())
    if (bytes.byteLength <= 12_000) {
      return new NextResponse(bytes, {
        headers: {
          "content-type": upstream.headers.get("content-type") || "image/jpeg",
          "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      })
    }

    const image = await loadImage(bytes)
    const scale = Math.min(1, width / Math.max(image.width, 1))
    const w = Math.max(1, Math.round(image.width * scale))
    const h = Math.max(1, Math.round(image.height * scale))
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext("2d")
    ctx.drawImage(image, 0, 0, w, h)
    const out = canvas.toBuffer("image/jpeg", 78)
    return new NextResponse(new Uint8Array(out), {
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    })
  } catch {
    return NextResponse.redirect(absolute)
  }
}
