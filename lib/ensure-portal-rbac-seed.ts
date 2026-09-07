import { sql } from "@/lib/db"
import {
  EXPECTED_ROLE_PERMISSION_COUNTS,
  INSTRUCTOR_ROLE_PERMISSION_CODES,
  ROLE_PERMISSION_CATALOG,
} from "@/lib/rbac-role-permission-catalog"
import { RBAC_PERMISSION_CODES } from "@/lib/rbac-permission-codes"

async function batchUpsertPermissions(codes: readonly string[]): Promise<void> {
  if (codes.length === 0) return
  await sql`
    INSERT INTO permissions (code, description)
    SELECT code, 'CourseCollab capability: ' || code
    FROM unnest(${codes}::text[]) AS code
    ON CONFLICT (code) DO NOTHING
  `
}

async function batchUpsertRolePermissions(role: string, codes: readonly string[]): Promise<void> {
  if (codes.length === 0) return
  await sql`
    INSERT INTO role_permissions (role, permission_code)
    SELECT ${role}, code
    FROM unnest(${codes}::text[]) AS code
    ON CONFLICT (role, permission_code) DO NOTHING
  `
}

async function instructorRolePermissionCount(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS n FROM role_permissions WHERE role = 'INSTRUCTOR'
  `) as { n: number }[]
  return rows[0]?.n ?? 0
}

/**
 * Idempotent RBAC catalog + role → permission mappings.
 * Always repairs missing rows (batch upsert). Safe on every login/setup.
 */
export async function ensurePortalRbacSeed(): Promise<void> {
  await batchUpsertPermissions(RBAC_PERMISSION_CODES)

  for (const [role, codes] of Object.entries(ROLE_PERMISSION_CATALOG)) {
    await batchUpsertRolePermissions(role, codes)
  }
}

/** Re-run seed when INSTRUCTOR mappings are incomplete (e.g. after code deploy). */
export async function repairPortalRbacSeedIfNeeded(): Promise<boolean> {
  const expected = EXPECTED_ROLE_PERMISSION_COUNTS.INSTRUCTOR ?? INSTRUCTOR_ROLE_PERMISSION_CODES.length
  const actual = await instructorRolePermissionCount()
  if (actual >= expected) return false
  await ensurePortalRbacSeed()
  return true
}

export {
  INSTRUCTOR_ROLE_PERMISSION_CODES,
  INSTRUCTOR_ROLE_PERMISSION_CODES as INSTRUCTOR_ROLE_PERMISSIONS,
} from "@/lib/rbac-role-permission-catalog"
