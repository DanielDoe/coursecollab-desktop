import bcrypt from "bcryptjs"

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$/

export async function hashAdminPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/** Supports bcrypt hashes and legacy plaintext rows in admin_users.password_hash. */
export async function verifyAdminPassword(
  password: string,
  storedHash: string | null | undefined,
): Promise<boolean> {
  const stored = String(storedHash ?? "")
  if (!stored || !password) return false
  if (BCRYPT_HASH_RE.test(stored)) {
    try {
      return await bcrypt.compare(password, stored)
    } catch {
      return false
    }
  }
  return password === stored
}

export function adminPasswordNeedsRehash(storedHash: string | null | undefined): boolean {
  const stored = String(storedHash ?? "")
  return stored.length > 0 && !BCRYPT_HASH_RE.test(stored)
}
