import { type NextRequest, NextResponse } from "next/server"
import {
  getServerEntitlements,
  rejectClientEntitlementClaims,
  type EntitlementActor,
} from "@/lib/compliance/entitlements"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { publicErrorMessage } from "@/lib/compliance/safe-error"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const roleParam = request.nextUrl.searchParams.get("role")
    const instructorId = Number(request.headers.get("x-instructor-id") ?? "")
    let actor: EntitlementActor | null = null

    if (roleParam === "instructor" || (Number.isFinite(instructorId) && instructorId > 0)) {
      if (!Number.isFinite(instructorId) || instructorId <= 0) {
        return NextResponse.json({ error: "Instructor authentication required." }, { status: 401 })
      }
      actor = { role: "instructor", accountId: instructorId }
    } else {
      const auth = await requireCallerStudentDbId(request)
      if (!auth.ok) return auth.response
      actor = {
        role: roleParam === "guest" ? "guest" : "student",
        accountId: auth.studentDbId,
      }
    }

    const snapshot = await getServerEntitlements(actor)
    return NextResponse.json(snapshot)
  } catch (error) {
    return NextResponse.json({ error: publicErrorMessage(error, "Unable to load entitlements.") }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  if (rejectClientEntitlementClaims(body)) {
    return NextResponse.json(
      { error: "Client entitlement claims are ignored. Access is determined server-side." },
      { status: 400 },
    )
  }
  return GET(request)
}
