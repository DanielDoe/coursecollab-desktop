import { type NextRequest, NextResponse } from "next/server"
import { getLegalContentCatalog, getLegalDocument, isLegalDocumentId } from "@/lib/compliance/legal-content"

export const dynamic = "force-dynamic"
export const runtime = "edge"

const CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=86400"

export async function GET(request: NextRequest) {
  const doc = request.nextUrl.searchParams.get("doc")

  if (doc) {
    if (!isLegalDocumentId(doc)) {
      return NextResponse.json({ error: "Unknown legal document id." }, { status: 404 })
    }
    const document = getLegalDocument(doc)
    return NextResponse.json(
      { version: document.updated, document },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    )
  }

  const catalog = getLegalContentCatalog()
  return NextResponse.json(catalog, { headers: { "Cache-Control": CACHE_CONTROL } })
}
