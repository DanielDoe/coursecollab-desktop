import { type NextRequest, NextResponse } from "next/server"
import { verifyAccessRequestEmail } from "@/lib/access-governance/email-verification"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    const result = await verifyAccessRequestEmail(String(token ?? ""))
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }
    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      email: result.email,
    })
  } catch (e) {
    console.error("[access/verify-email]", e)
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
