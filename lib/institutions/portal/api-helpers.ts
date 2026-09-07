import type { InstitutionAdminRole } from "@/lib/institutions/auth"
import { institutionHasPermission, institutionPermissions, type InstitutionPermission } from "@/lib/institutions/permissions"

export function withInstitutionPortalContext<T>(role: InstitutionAdminRole, payload: T) {
  return {
    ...payload,
    role,
    permissions: institutionPermissions(role),
  }
}

export function requirePortalPermission(role: InstitutionAdminRole, permission: InstitutionPermission): boolean {
  return institutionHasPermission(role, permission)
}
