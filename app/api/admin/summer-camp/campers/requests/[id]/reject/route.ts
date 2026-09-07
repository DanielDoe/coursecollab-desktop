import { type NextRequest, NextResponse } from "next/server"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { rejectAccessRequest } from "@/lib/access-governance/service"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest,
  { params }: { params: Promise<{ id: string }> },) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const { reason } = await request.json().catch(() => ({ reason: null }))

    await rejectAccessRequest({
      requestId: Number(id),
      reviewer: { role: "admin", adminId },
      reason: reason ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[admin/campers/reject]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rejection failed" },
      { status: 500 },
    )
  }
}
