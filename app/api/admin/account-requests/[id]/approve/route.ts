import { NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { approveAccessRequest } from "@/lib/access-governance/service"
import { ensureAccessGovernanceSchema } from "@/lib/access-governance/schema"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureAccessGovernanceSchema()
    const { id } = await params
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    const result = await approveAccessRequest({
      requestId: Number(id),
      reviewer: { role: "admin", adminId: admin.adminId },
      approvalSource: "admin",
    })

    return NextResponse.json({
      success: true,
      studentId: result.accountType === "faculty" ? undefined : result.userId,
      instructorId: result.accountType === "faculty" ? result.userId : undefined,
      message: result.message,
    })
  } catch (error) {
    console.error("[Admin - Approve Account] Error:", error)
    const message = error instanceof Error ? error.message : "Failed to approve account request"
    const status = message.includes("not found") ? 404 : message.includes("outside") || message.includes("cannot") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
