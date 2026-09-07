import { sql } from "@/lib/db"

/** Unambiguous chars (no 0/O, 1/I/L). */
const PASSCODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

export function generatePlaygroundPasscode(length = 5): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += PASSCODE_CHARS[Math.floor(Math.random() * PASSCODE_CHARS.length)]
  }
  return code
}

export function normalizePlaygroundPasscode(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5)
}

/** Generate a passcode not currently used by an active lobby. */
export async function generateUniquePlaygroundPasscode(maxAttempts = 20): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generatePlaygroundPasscode()
    const existing = await sql`
      SELECT id FROM playground_sessions
      WHERE is_active = true
        AND join_passcode IS NOT NULL
        AND UPPER(join_passcode) = ${code}
      LIMIT 1
    `
    if (!Array.isArray(existing) || existing.length === 0) {
      return code
    }
  }
  throw new Error("Unable to generate unique playground passcode")
}
