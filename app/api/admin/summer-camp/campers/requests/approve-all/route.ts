import { type NextRequest, NextResponse } from "next/server"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"
import { approveAllPendingSummerCamperRequests } from "@/lib/summer-camp/camper-accounts"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const result = await approveAllPendingSummerCamperRequests(adminId)

    return NextResponse.json({
      success: true,
      approvedCount: result.approved.length,
      failedCount: result.failed.length,
      ...result,
      message:
        result.failed.length === 0
          ? `Approved ${result.approved.length} camper account${result.approved.length === 1 ? "" : "s"}.`
          : `Approved ${result.approved.length}; ${result.failed.length} could not be approved.`,
    })
  } catch (error) {
    console.error("[admin/campers/approve-all]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk approval failed" },
      { status: 500 },
    )
  }
}
