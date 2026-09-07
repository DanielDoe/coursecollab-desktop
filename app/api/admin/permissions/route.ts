import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { listAllPermissions } from "@/lib/permission-grants"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const permissions = await listAllPermissions()
    return NextResponse.json({ permissions })
  } catch (error) {
    console.error("[admin/permissions]", error)
    return NextResponse.json({ error: "Failed to load permissions" }, { status: 500 })
  }
}
