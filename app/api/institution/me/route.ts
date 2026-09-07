import { type NextRequest, NextResponse } from "next/server"
import { requireInstitutionAdmin } from "@/lib/institutions/auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const auth = await requireInstitutionAdmin(request)
  if (!auth.ok) return auth.response
  return NextResponse.json({
    institutionId: auth.session.institutionId,
    institutionName: auth.session.institutionName,
    role: auth.session.role,
    userType: auth.session.userType,
    userId: auth.session.userId,
  })
}
