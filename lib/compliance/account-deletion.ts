import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { ensurePushTokensSchema } from "@/lib/ensure-push-tokens-schema"
import { revokeAllRefreshTokensForUser } from "@/lib/auth-refresh-tokens"
import { verifyFacultyPassword } from "@/lib/faculty-password"
import {
  ACCOUNT_DELETION_POLICY,
  type AccountDeletionFailure,
  type AccountDeletionResult,
  type AccountKind,
} from "@/lib/compliance/account-deletion-policy"
import { recordSecurityEvent } from "@/lib/compliance/audit-log"

let schemaReady = false

export async function ensureAccountDeletionSchema(): Promise<void> {
  if (schemaReady) return
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`ALTER TABLE instructors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  await sql`
    CREATE TABLE IF NOT EXISTS account_deletion_audit (
      id SERIAL PRIMARY KEY,
      account_kind VARCHAR(16) NOT NULL,
      account_id INTEGER NOT NULL,
      result VARCHAR(32) NOT NULL,
      deleted TEXT[] NOT NULL DEFAULT '{}',
      anonymized TEXT[] NOT NULL DEFAULT '{}',
      retained TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  schemaReady = true
}

export function isDeletedAccountRow(row: Record<string, unknown> | null | undefined): boolean {
  const value = row?.deleted_at
  return value != null && String(value).trim() !== ""
}

async function verifyStudentPassword(accountId: number, password: string): Promise<boolean> {
  const rows = await sql`
    SELECT password_hash, deleted_at
    FROM students
    WHERE id = ${accountId}
    LIMIT 1
  `
  const row = rows[0] as { password_hash?: string; deleted_at?: string | null } | undefined
  if (!row || isDeletedAccountRow(row as Record<string, unknown>)) return false
  return bcrypt.compare(password, String(row.password_hash ?? ""))
}

async function verifyInstructorPassword(accountId: number, password: string): Promise<boolean> {
  const rows = await sql`
    SELECT password, deleted_at
    FROM instructors
    WHERE id = ${accountId}
    LIMIT 1
  `
  const row = rows[0] as { password?: string; deleted_at?: string | null } | undefined
  if (!row || isDeletedAccountRow(row as Record<string, unknown>)) return false
  return verifyFacultyPassword(password, row.password)
}

async function deleteOwnedConversations(kind: AccountKind, accountId: number): Promise<string[]> {
  const deleted: string[] = []
  if (kind === "instructor") {
    await sql`DELETE FROM instructor_cora_threads WHERE instructor_id = ${accountId}`.catch(() => undefined)
    deleted.push("instructor_cora_threads")
    return deleted
  }
  await sql`DELETE FROM ai_tutor_conversations WHERE student_id = ${accountId}`.catch(() => undefined)
  await sql`DELETE FROM cora_workspace_threads WHERE student_id = ${accountId}`.catch(() => undefined)
  deleted.push("ai_tutor_conversations", "cora_workspace_threads")
  return deleted
}

async function revokePushTokens(kind: AccountKind, accountId: number): Promise<void> {
  await ensurePushTokensSchema()
  const ownerKind = kind === "instructor" ? "instructor" : "student"
  await sql`
    DELETE FROM expo_push_tokens
    WHERE owner_kind = ${ownerKind} AND owner_id = ${accountId}
  `
}

async function writeAudit(result: AccountDeletionResult): Promise<void> {
  await sql`
    INSERT INTO account_deletion_audit (
      account_kind, account_id, result, deleted, anonymized, retained
    ) VALUES (
      ${result.accountKind},
      ${result.accountId},
      'completed',
      ${result.deleted},
      ${result.anonymized},
      ${result.retained}
    )
  `
}

export async function deleteAccount(input: {
  accountKind: AccountKind
  accountId: number
  password: string
  confirm: boolean
}): Promise<AccountDeletionResult | AccountDeletionFailure> {
  if (!input.confirm) {
    return { ok: false, status: 400, error: "Deletion must be explicitly confirmed." }
  }
  if (!input.password || input.password.length < 1) {
    return { ok: false, status: 401, error: "Reauthentication is required." }
  }
  if (!Number.isFinite(input.accountId) || input.accountId <= 0) {
    return { ok: false, status: 400, error: "Invalid account." }
  }

  await ensureAccountDeletionSchema()

  const passwordOk =
    input.accountKind === "instructor"
      ? await verifyInstructorPassword(input.accountId, input.password)
      : await verifyStudentPassword(input.accountId, input.password)
  if (!passwordOk) {
    return { ok: false, status: 401, error: "Password is incorrect or the account is already deleted." }
  }

  const burnedHash = await bcrypt.hash(`deleted-${input.accountId}-${Date.now()}-${Math.random()}`, 10)
  const tombstoneEmail = `deleted-${input.accountKind}-${input.accountId}@invalid.coursecollab.local`
  const conversationTables = await deleteOwnedConversations(input.accountKind, input.accountId)
  await revokePushTokens(input.accountKind, input.accountId)
  await revokeAllRefreshTokensForUser(
    input.accountKind === "instructor" ? "instructor" : "student",
    input.accountId,
  )

  if (input.accountKind === "instructor") {
    await sql`
      UPDATE instructors
      SET
        name = 'Deleted Instructor',
        email = ${tombstoneEmail},
        username = ${`deleted-instructor-${input.accountId}`},
        password = ${burnedHash},
        deleted_at = NOW(),
        is_active = false
      WHERE id = ${input.accountId}
    `
  } else {
    await sql`
      UPDATE students
      SET
        full_name = 'Deleted User',
        email = ${tombstoneEmail},
        password_hash = ${burnedHash},
        student_id = ${`DEL-${input.accountId}`},
        deleted_at = NOW()
      WHERE id = ${input.accountId}
    `
  }

  const result: AccountDeletionResult = {
    ok: true,
    accountKind: input.accountKind,
    accountId: input.accountId,
    deleted: [
      "credentials",
      "push_tokens",
      "refresh_tokens",
      ...conversationTables,
    ],
    anonymized: [...ACCOUNT_DELETION_POLICY.anonymized],
    retained: [
      ...ACCOUNT_DELETION_POLICY.retainedInstitutional,
      ...ACCOUNT_DELETION_POLICY.retainedFinancial,
    ],
  }
  await writeAudit(result).catch(() => undefined)
  await recordSecurityEvent({
    actorRole: input.accountKind,
    actorId: input.accountId,
    action: "account.delete",
    resourceType: "account",
    resourceId: input.accountId,
    outcome: "success",
    metadata: { deleted: result.deleted, retained: result.retained },
  }).catch(() => undefined)
  return result
}
