import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { isCoraGithubEnabled } from "@/lib/cora/github-submit-fix"

export const dynamic = "force-dynamic"

/** Admin only: mirrors the authorization on submit-fix rather than advertising the capability. */
export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  return NextResponse.json({ enabled: isCoraGithubEnabled() })
}
