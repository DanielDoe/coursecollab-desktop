import { type NextRequest, NextResponse } from "next/server"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { approveAccessRequest } from "@/lib/access-governance/service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const result = await approveAccessRequest({
      requestId: Number(id),
      reviewer: { role: "admin", adminId },
      approvalSource: "admin",
    })

    return NextResponse.json({
      success: true,
      studentId: result.userId,
      accountType: result.accountType,
      message: result.message,
    })
  } catch (error) {
    console.error("[admin/campers/approve]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Approval failed" },
      { status: 500 },
    )
  }
}
