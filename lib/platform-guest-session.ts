import { sql } from "@/lib/db"

let cachedGuestSessionId: number | undefined

/** Catalog row used only to satisfy FKs for platform guest students. */
export async function getPlatformGuestSessionId(): Promise<number> {
  if (cachedGuestSessionId != null) return cachedGuestSessionId
  const rows = (await sql`
    SELECT id FROM sessions WHERE code = 'GUEST' LIMIT 1
  `) as { id: number }[]
  if (rows.length === 0) {
    throw new Error('Session code "GUEST" is missing. Run migration add-platform-guest-students.sql.')
  }
  cachedGuestSessionId = Number(rows[0].id)
  return cachedGuestSessionId
}

export function generateGuestExternalStudentId(): string {
  const u = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}`
  return `GUEST-${u.slice(0, 16)}`
}
