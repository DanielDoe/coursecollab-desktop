import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { buildAdminCoraSession } from "@/lib/cora/security"
import { resolveModuleCapabilities } from "@/lib/cora/capabilities/resolve-capabilities"
import {
  ADMIN_CORA_MODULE_REGISTRY,
  ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
  type AdminCoraModuleId,
} from "@/lib/cora/capabilities/admin-module-registry"
import { CORA_AUTHORIZATION_PIPELINE } from "@/lib/cora/capabilities/authorization-pipeline"
import { CORA_ACTION_RISK_META } from "@/lib/cora/capabilities/risk-levels"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/cora/capabilities
 * Admin Cora capability boundary for the authenticated administrator.
 *
 * Planned modules return registered capability IDs but no executable tools.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminId(request)
    if (!auth.ok) return auth.response

    const adminId = Number.parseInt(String(auth.adminId), 10)
    if (!Number.isFinite(adminId) || adminId <= 0) {
      return NextResponse.json({ error: "Invalid admin session" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const modulesParam = searchParams.get("modules")
    const focusModules = modulesParam?.split(",").filter(Boolean) as
      | AdminCoraModuleId[]
      | undefined
    const institutionIdRaw = searchParams.get("institutionId")
    const institutionId =
      institutionIdRaw != null && Number.isFinite(Number(institutionIdRaw))
        ? Number(institutionIdRaw)
        : null

    const session = await buildAdminCoraSession({
      adminId,
      institutionId,
    })

    const resolved = resolveModuleCapabilities({
      session,
      focusModules:
        focusModules && focusModules.length > 0
          ? focusModules
          : (Object.keys(ADMIN_CORA_MODULE_REGISTRY) as AdminCoraModuleId[]),
    })

    const liveModules = Object.values(ADMIN_CORA_MODULE_REGISTRY).filter(
      (m) => m.status === "live",
    ).length
    const plannedModules = Object.values(ADMIN_CORA_MODULE_REGISTRY).filter(
      (m) => m.status === "planned",
    ).length

    return NextResponse.json({
      principle: ADMIN_CORA_AUTHORIZATION_PRINCIPLE,
      pipeline: CORA_AUTHORIZATION_PIPELINE,
      riskScale: CORA_ACTION_RISK_META,
      principal: {
        userId: session.userId,
        role: session.role,
        institutionId: session.institutionId,
      },
      modules: resolved.modules,
      capabilityIds: resolved.capabilityIds,
      packet: resolved.packet,
      registryVersion: 3,
      moduleCount: Object.keys(ADMIN_CORA_MODULE_REGISTRY).length,
      liveModules,
      plannedModules,
      note:
        "Admin ≠ Faculty. Planned modules register future capabilities but expose no tools until services exist.",
    })
  } catch (error) {
    console.error("[admin/cora/capabilities]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load capabilities" },
      { status: 500 },
    )
  }
}
