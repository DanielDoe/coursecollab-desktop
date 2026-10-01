import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  return NextResponse.json(
    {
      error: "Donations are no longer accepted. Upgrade to Explorer or Trailblazer for access.",
    },
    { status: 410 },
  )
}
