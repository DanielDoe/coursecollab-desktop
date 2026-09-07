import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { readInstructorSessionScopeFromRequest } from "@/lib/instructor-session-scope"
import { normalizedSectionVariantsForSql } from "@/lib/session-code-aliases"

export type ModuleContentSessionFilter =
  | { mode: "all" }
  | { mode: "section"; sessionCode: string; sessionVariants: string[] }

/** True when row is course-wide or matches the active section filter. */
export function moduleContentMatchesSessionFilter(
  rowSession: string | null | undefined,
  filter: ModuleContentSessionFilter,
): boolean {
  if (filter.mode === "all") return true
  const normalized = String(rowSession ?? "").trim()
  if (!normalized) return true
  return (
    filter.sessionVariants.includes(normalized) ||
    normalized === filter.sessionCode
  )
}

/**
 * Resolve section filter for flashcards / course notes.
 * Query `session=ALL` → entire course. Specific code → that section (+ course-wide rows).
 * Otherwise uses instructor `x-session-id` header when present.
 */
export async function resolveModuleContentSessionFilter(
  request: NextRequest,
  querySession?: string | null,
): Promise<ModuleContentSessionFilter> {
  const query = querySession?.trim()
  if (query && query !== "ALL") {
    return {
      mode: "section",
      sessionCode: query,
      sessionVariants: normalizedSectionVariantsForSql(query),
    }
  }

  if (query === "ALL") {
    return { mode: "all" }
  }

  const scope = readInstructorSessionScopeFromRequest(request)
  if (scope.sessionId != null) {
    const rows = (await sql`
      SELECT code FROM sessions WHERE id = ${scope.sessionId} LIMIT 1
    `) as { code: string }[]
    const code = rows[0]?.code?.trim()
    if (code) {
      return {
        mode: "section",
        sessionCode: code,
        sessionVariants: normalizedSectionVariantsForSql(code),
      }
    }
  }

  return { mode: "all" }
}

export function moduleContentSessionFilterLabel(filter: ModuleContentSessionFilter): string {
  return filter.mode === "all" ? "ALL" : filter.sessionCode
}
