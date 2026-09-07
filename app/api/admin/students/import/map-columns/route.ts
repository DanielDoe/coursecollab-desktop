import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { coraMapRosterColumns } from "@/lib/roster-column-map-cora"
import { autoMapRosterHeaders, mergeRosterMappings, refineRosterMappingFromRows } from "@/lib/roster-csv"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const body = (await request.json()) as {
      headers?: string[]
      samples?: Record<string, string>[]
    }
    const headers = Array.isArray(body.headers) ? body.headers.map((h) => String(h)) : []
    if (headers.length === 0) {
      return NextResponse.json({ error: "headers are required" }, { status: 400 })
    }
    const samples = Array.isArray(body.samples) ? body.samples.slice(0, 4) : []
    const heuristic = autoMapRosterHeaders(headers)
    const cora = await coraMapRosterColumns(headers, samples)
    const mapping = refineRosterMappingFromRows(
      mergeRosterMappings(heuristic, cora.mapping),
      samples,
    )
    return NextResponse.json({
      mapping,
      notes: cora.notes || "Cora mapped these columns from your Canvas export.",
    })
  } catch (error) {
    console.error("[admin/students/import/map-columns]", error)
    return NextResponse.json({ error: "Could not map columns" }, { status: 500 })
  }
}
