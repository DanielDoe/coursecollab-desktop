import { type NextRequest, NextResponse } from "next/server"
import { getStudentCodeBenchEntitlement } from "@/lib/codebench-entitlement"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

/** Authenticated student with core CodeBench access (Scholar and above). */
export async function requireCodebenchStudent(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireBoundStudentCaller(request, claimedStudentId)
  if (!caller.ok) return caller

  const entitlement = await getStudentCodeBenchEntitlement(caller.studentDbId)
  if (!entitlement.access) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "CodeBench is not available for this account.",
          accessDenied: true,
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, studentDbId: caller.studentDbId }
}

/** Authenticated student who may invoke Cora-powered CodeBench actions. */
export async function requireCodebenchCoraStudent(
  request: NextRequest,
  claimedStudentId?: string | null,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const caller = await requireCodebenchStudent(request, claimedStudentId)
  if (!caller.ok) return caller

  const entitlement = await getStudentCodeBenchEntitlement(caller.studentDbId)
  if (!entitlement.coraAccess) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "Cora in CodeBench requires Explorer or Trailblazer membership.",
          membershipRequired: true,
          upgradeRequired: "Explorer",
          accessDenied: true,
        },
        { status: 403 },
      ),
    }
  }

  return { ok: true, studentDbId: caller.studentDbId }
}
