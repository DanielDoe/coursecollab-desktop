import { type NextRequest, NextResponse } from "next/server"
import { fetchPublicOfficeHoursPage } from "@/lib/office-hours-public-profile"

export const dynamic = "force-dynamic"

function parseOptionalId(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const normalized = String(slug ?? "").trim().toLowerCase()
    if (!normalized) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 })
    }

    const universityId = parseOptionalId(request.nextUrl.searchParams.get("universityId"))
    const academicTermId = parseOptionalId(request.nextUrl.searchParams.get("academicTermId"))

    const page = await fetchPublicOfficeHoursPage(normalized, universityId, academicTermId)
    if (!page) {
      return NextResponse.json({ error: "Office hours page not found" }, { status: 404 })
    }

    return NextResponse.json(page)
  } catch (error) {
    console.error("[Public Office Hours] GET:", error)
    return NextResponse.json({ error: "Failed to load office hours" }, { status: 500 })
  }
}
