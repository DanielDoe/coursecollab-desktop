import { type NextRequest, NextResponse } from "next/server"
import { listCoraPacks, type CoraPackAudience } from "@/lib/cora/credits/packs"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const audience = request.nextUrl.searchParams.get("audience") as CoraPackAudience | null
  const packs = listCoraPacks(audience === "student" || audience === "instructor" ? audience : undefined)
  return NextResponse.json({
    packs: packs.map((p) => ({
      id: p.id,
      audience: p.audience,
      name: p.name,
      credits: p.credits,
      priceInCents: p.priceInCents,
      priceDisplay: `$${(p.priceInCents / 100).toFixed(2)}`,
      description: p.description,
      perThousandDisplay: `$${((p.priceInCents / 100) / (p.credits / 1000)).toFixed(2)}/1K`,
    })),
  })
}
