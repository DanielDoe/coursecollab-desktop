import type { NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { DESKTOP_CLIENT_HEADER } from "@/lib/desktop-auth-policy"

export function isDesktopClientRequest(request: NextRequest | Request): boolean {
  return request.headers.get(DESKTOP_CLIENT_HEADER)?.trim().toLowerCase() === "desktop"
}

/**
 * When true, finalized answers (including code) cannot be changed after Save & Finish Later resume.
 * Same rules as the web app — not tied to desktop vs browser.
 */
export function requiresStrictAttemptAnswerLock(input: {
  savedForLaterAt?: Date | string | null
}): boolean {
  if (input.savedForLaterAt == null || input.savedForLaterAt === "") return false
  return true
}

export async function getAttemptStrictAnswerLockContext(
  attemptId: number,
  request: NextRequest | Request,
): Promise<{ strict: boolean; savedForLaterAt: Date | null }> {
  const rows = await sql`
    SELECT saved_for_later_at
    FROM quiz_attempts
    WHERE id = ${attemptId} AND deleted_at IS NULL
    LIMIT 1
  `
  const savedForLaterAt = (rows[0]?.saved_for_later_at as Date | null | undefined) ?? null
  return {
    savedForLaterAt,
    strict: requiresStrictAttemptAnswerLock({ savedForLaterAt }),
  }
}
