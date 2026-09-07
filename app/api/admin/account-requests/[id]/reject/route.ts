import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { rejectAccessRequest } from "@/lib/access-governance/service"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureAccessGovernanceSchema()
    const { id } = await params
    const { reason } = await request.json()
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    await rejectAccessRequest({
      requestId: Number(id),
      reviewer: { role: "admin", adminId: admin.adminId },
      reason,
    })

    return NextResponse.json({
      success: true,
      message: "Account request rejected successfully",
    })
  } catch (error) {
    console.error("[Admin - Reject Account] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to reject account request"
    return NextResponse.json({ error: message }, { status: message.includes("not found") ? 404 : 500 })
  }
}
