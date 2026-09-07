import { type NextRequest, NextResponse } from "next/server"
import { getStudentDatabaseIdFromRequest } from "@/lib/ai-notetaker-request"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"

function normalizeClaim(value: unknown): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Claimed numeric `students.id` from query, legacy header, or body field. */
export function claimedStudentDatabaseIdFromRequest(request: NextRequest): string | null {
  const fromQuery = getStudentDatabaseIdFromRequest(request)
  if (fromQuery != null) return String(fromQuery)
  return (
    normalizeClaim(request.headers.get("x-student-database-id")) ??
    normalizeClaim(request.headers.get("x-student-id"))
  )
}

/** Session-bound student for AI Notetaker routes (binds refresh/MFA to claimed id). */
export async function requireAiNotetakerStudent(
  request: NextRequest,
  bodyClaim?: unknown,
): Promise<{ ok: true; studentDbId: number } | { ok: false; response: NextResponse }> {
  const claimed = normalizeClaim(bodyClaim) ?? claimedStudentDatabaseIdFromRequest(request)
  return requireBoundStudentCaller(request, claimed)
}
