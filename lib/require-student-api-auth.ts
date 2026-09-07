import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"

/** Require a real student session. `x-student-id` alone is not identity. */
export async function requireStudentApiAuth(
  request: NextRequest,
): Promise<{ studentDbId: number } | NextResponse> {
  const auth = await requireCallerStudentDbId(request)
  if (!auth.ok) return auth.response
  return { studentDbId: auth.studentDbId }
}

/** Legacy login flow — only when explicitly requested (deprecated). */
export function isLegacyLoginRequest(request: NextRequest): boolean {
  return request.headers.get("x-coursecollab-legacy-login") === "1"
}
