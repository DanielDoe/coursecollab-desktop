import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { FACULTY_DEFAULT_PASSWORD } from "@/lib/faculty-default-password"

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/

let passwordColumnReady = false

export async function ensureFacultyPasswordColumn(): Promise<void> {
  if (passwordColumnReady) return
  await sql`ALTER TABLE instructors ALTER COLUMN password TYPE VARCHAR(255)`.catch(() => undefined)
  passwordColumnReady = true
}

export async function hashFacultyPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyFacultyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  const value = String(stored ?? "")
  if (!value || !password) return false
  if (BCRYPT_HASH_RE.test(value)) {
    try {
      return await bcrypt.compare(password, value)
    } catch {
      return false
    }
  }
  return password === value
}

export function facultyPasswordNeedsRehash(stored: string | null | undefined): boolean {
  const value = String(stored ?? "")
  return value.length > 0 && !BCRYPT_HASH_RE.test(value)
}

export async function isFacultyDefaultPassword(stored: string | null | undefined): Promise<boolean> {
  return verifyFacultyPassword(FACULTY_DEFAULT_PASSWORD, stored)
}

/** Gate is driven by default password hash, not the flag alone (fixes stale has_changed_password). */
export async function resolveFacultyPasswordGate(params: {
  instructorId: number
  passwordHash: string
  hasChangedPasswordFlag: boolean
}): Promise<{
  stillDefault: boolean
  hasChangedPassword: boolean
  requiresPasswordChange: boolean
}> {
  const stillDefault = await isFacultyDefaultPassword(params.passwordHash)
  const requiresPasswordChange = stillDefault
  const hasChangedPassword = !stillDefault || params.hasChangedPasswordFlag

  if (!stillDefault && !params.hasChangedPasswordFlag) {
    await sql`
      UPDATE instructors
      SET has_changed_password = true
      WHERE id = ${params.instructorId}
    `
  }

  return { stillDefault, hasChangedPassword, requiresPasswordChange }
}
