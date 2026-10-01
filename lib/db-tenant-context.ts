import { runSqlTransaction, sql, type TransactionSql } from "@/lib/db"
import { SECURITY_AUDIT_ACTIONS } from "@/lib/security/actions"
import { recordSecurityAuditEvent } from "@/lib/security/audit"
import {
  normalizePrivilegedDbContext,
  type PrivilegedContextInput,
} from "@/lib/security/privileged-context"

export const TENANT_DB_ROLE = "coursecollab_tenant"
export const TENANT_ACCESS_MODE = "tenant"
export const PRIVILEGED_ACCESS_MODE = "privileged"

export class TenantDbContextError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_institution_id"
      | "missing_tenant_db_context"
      | "tenant_mismatch"
      | "privileged_required",
  ) {
    super(message)
    this.name = "TenantDbContextError"
  }
}

export type TenantSql = {
  (strings: TemplateStringsArray, ...values: any[]): Promise<any[]>
}

function logTenantDb(event: string, meta?: Record<string, unknown>) {
  console.info("[tenant-db]", event, meta ?? {})
}

/**
 * Institution id must already be Stage 4–verified.
 * Rejects client-shaped values (non-integers, zero, negatives).
 */
export function assertVerifiedInstitutionId(institutionId: unknown): number {
  const id = Math.trunc(Number(institutionId))
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) {
    logTenantDb("missing_tenant_db_context", { institutionId })
    throw new TenantDbContextError("invalid institution id for tenant db context", "invalid_institution_id")
  }
  return id
}

function tenantPreamble(tx: TransactionSql, institutionId: number) {
  const id = String(institutionId)
  return [
    tx`SET LOCAL ROLE coursecollab_tenant`,
    tx`SELECT set_config('app.access_mode', 'tenant', true)`,
    tx`SELECT set_config('app.institution_id', ${id}, true)`,
    tx`SET LOCAL search_path = public, pg_catalog`,
  ]
}

/**
 * Transaction-scoped tenant context. SET LOCAL + SET LOCAL ROLE; cannot leak
 * across Neon HTTP requests. `institutionId` must come from Stage 4 authorization.
 */
export async function withInstitutionDbContext<T = Record<string, unknown>>(
  institutionId: number,
  build: (tx: TransactionSql) => unknown[],
): Promise<T[][]> {
  const id = assertVerifiedInstitutionId(institutionId)
  logTenantDb("tenant_context_set", { institutionId: id })
  try {
    const results = await runSqlTransaction<T>((tx) => [...tenantPreamble(tx, id), ...build(tx)])
    return results.slice(4)
  } catch (error) {
    logTenantDb("rls_denied_or_query_failed", {
      institutionId: id,
      message: error instanceof Error ? error.message.slice(0, 180) : "error",
    })
    throw error
  }
}

function tenantQuery(tx: TransactionSql, strings: TemplateStringsArray, values: any[]) {
  const hasUnsafe = values.some((v) => v && typeof v === "object" && "__unsafe" in v && v.__unsafe)
  if (!hasUnsafe) return tx(strings, ...values)
  let text = strings[0]
  const params: any[] = []
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value && typeof value === "object" && "__unsafe" in value && value.__unsafe) {
      text += String(value.__sql) + strings[i + 1]
    } else {
      params.push(value)
      text += `$${params.length}` + strings[i + 1]
    }
  }
  return tx.query(text, params)
}

/** Single-query helper for Wave 1/2 tenant-scoped reads/writes. */
export function createInstitutionSql(institutionId: number): TenantSql {
  const id = assertVerifiedInstitutionId(institutionId)
  return async (strings: TemplateStringsArray, ...values: any[]) => {
    const results = await withInstitutionDbContext(id, (tx) => [tenantQuery(tx, strings, values)])
    return results[0] ?? []
  }
}

/**
 * Explicit platform/privileged path. Uses the application owner role (BYPASSRLS).
 * Owner/BYPASSRLS bypasses tenant RLS. Absence of tenant context is not privileged.
 */
export async function withPlatformPrivilegedDbContext<T>(
  reason: PrivilegedContextInput,
  fn: () => Promise<T>,
): Promise<T> {
  let context
  try {
    context = normalizePrivilegedDbContext(reason)
  } catch {
    throw new TenantDbContextError("privileged db path requires a reason", "privileged_required")
  }
  logTenantDb("privileged_db_path_used", {
    reason: context.operation,
    reasonCode: context.reasonCode,
    institutionId: context.institutionId ?? null,
  })
  if (context.audit) {
    await recordSecurityAuditEvent({
      actorType: context.actorType ?? "system",
      actorId: context.actorId ?? null,
      institutionId: context.institutionId ?? null,
      action: SECURITY_AUDIT_ACTIONS.PLATFORM_PRIVILEGED_ACCESS,
      resourceType: context.resourceType ?? null,
      resourceId: context.resourceId ?? null,
      result: "success",
      reasonCode: context.reasonCode,
      eventScope: context.institutionId != null ? "institution" : "platform",
      failClosed: context.failClosed === true,
      metadata: {
        operation: context.operation,
        ticketReference: context.ticketReference ?? null,
      },
    })
  }
  return fn()
}

/** Privileged tagged template (owner / BYPASSRLS). Identifiable alias of `sql`. */
export const platformPrivilegedSql = sql

/** Test/harness: tenant role with no institution GUC — must fail closed. */
export async function withTenantRoleMissingInstitution<T = Record<string, unknown>>(
  build: (tx: TransactionSql) => unknown[],
): Promise<T[][]> {
  logTenantDb("missing_tenant_db_context", { mode: "tenant_role_only" })
  const results = await runSqlTransaction<T>((tx) => [
    tx`SET LOCAL ROLE coursecollab_tenant`,
    tx`SELECT set_config('app.access_mode', '', true)`,
    tx`SELECT set_config('app.institution_id', '', true)`,
    tx`SET LOCAL search_path = public, pg_catalog`,
    ...build(tx),
  ])
  return results.slice(4)
}
