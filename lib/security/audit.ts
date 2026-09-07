import { logPlatformActivityFromRequest } from "@/lib/platform-activity-log"
import type { NextRequest } from "next/server"

export type SecurityAuditAction =
  | "role.change"
  | "permission.change"
  | "assessment.publish"
  | "grade.change"
  | "account.approve"
  | "course.assign"
  | "bulk.delete"
  | "admin.mutation"
  | "cora.confirm"

/** Record a consequential security event. Never log secrets or raw bodies. */
export async function logSecurityEvent(
  request: NextRequest | null,
  input: {
    action: SecurityAuditAction | string
    actorType: "admin" | "instructor" | "student" | "cora" | "system"
    actorId?: number | string | null
    resourceType?: string
    resourceId?: number | string | null
    success?: boolean
    summary: string
  },
): Promise<void> {
  try {
    if (request) {
      await logPlatformActivityFromRequest(request, {
        portal: input.actorType === "admin" ? "admin" : input.actorType === "instructor" ? "faculty" : "student",
        actorType: input.actorType === "cora" ? "system" : input.actorType,
        actorId: input.actorId != null ? Number(input.actorId) : undefined,
        action: input.action,
        category: "admin",
        success: input.success !== false,
        summary: input.summary.slice(0, 400),
        metadata: {
          resourceType: input.resourceType,
          resourceId: input.resourceId != null ? String(input.resourceId) : undefined,
        },
      })
    }
  } catch {
    /* audit must never fail the mutation */
  }
}
