import type { NextRequest } from "next/server"
import { logAuthError } from "@/lib/system-log"
import type { TenantActorType, TenantResourceType } from "@/lib/tenant/types"

export async function logTenantAuthorizationFailure(
  request: NextRequest,
  input: {
    actorType: TenantActorType
    actorId: number | null
    resourceType?: TenantResourceType
    resourceId?: number | null
    resolvedInstitutionId?: number | null
    activeInstitutionId?: number | null
    reason: string
  },
): Promise<void> {
  await logAuthError(request, {
    action: "tenant_authorization_denied",
    userId: input.actorId != null ? String(input.actorId) : null,
    userRole: input.actorType,
    errorMessage: input.reason,
    success: false,
    requiredPermission: input.resourceType,
    pageAttempted: undefined,
  }).catch(() => undefined)
}
