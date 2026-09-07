import { sql } from "@/lib/db"
import { ensurePortalRbacSchema } from "@/lib/ensure-portal-rbac-schema"
import { normalizePlatformRole, type PlatformRole } from "@/lib/roles"

/**
 * Effective permissions for an admin portal session (platform scope, not course-scoped).
 */
export async function getPlatformPermissions(
  platformRole: string | null | undefined,
  adminUserId?: number | null,
): Promise<{ role: PlatformRole; permissions: string[] }> {
  await ensurePortalRbacSchema()
  const role = normalizePlatformRole(platformRole)

  const rows = await sql`
    SELECT permission_code FROM role_permissions WHERE role = ${role}
  `
  const permissions = new Set(
    (rows as { permission_code: string }[]).map((r) => r.permission_code),
  )

  if (permissions.size === 0 && role === "PLATFORM_ADMIN") {
    const all = await sql`SELECT code FROM permissions`
    for (const row of all as { code: string }[]) permissions.add(row.code)
  }

  if (adminUserId != null) {
    const grantRows = await sql`
      SELECT permission_code FROM admin_user_permissions
      WHERE admin_user_id = ${adminUserId} AND enabled = true
    `
    for (const row of grantRows as { permission_code: string }[]) {
      permissions.add(row.permission_code)
    }
  }

  return { role, permissions: Array.from(permissions).sort() }
}

export { hasPermission, hasAnyPermission } from "@/lib/permission-utils"
