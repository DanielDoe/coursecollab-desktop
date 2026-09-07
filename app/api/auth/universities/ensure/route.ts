import { type NextRequest, NextResponse } from "next/server"
import { ensureUniversityFromCatalog, getUniversityById } from "@/lib/universities"

export const dynamic = "force-dynamic"

/** Persist a catalog pick into `universities` so accounts can FK to it. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const id = Number(body.id)
    if (Number.isFinite(id) && id > 0) {
      const existing = await getUniversityById(id)
      if (existing) return NextResponse.json({ university: existing })
    }
    const university = await ensureUniversityFromCatalog({
      name: String(body.name ?? ""),
      domain: String(body.domain ?? ""),
      shortName: String(body.shortName ?? body.short_name ?? ""),
    })
    return NextResponse.json({ university })
  } catch (error) {
    console.error("[auth/universities/ensure]", error)
    return NextResponse.json({ error: "Could not save university" }, { status: 500 })
  }
}
