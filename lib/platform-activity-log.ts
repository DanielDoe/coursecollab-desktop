import { type NextRequest } from "next/server"
import { sql } from "@/lib/db"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"
import {
  ACTIVITY_ACTIONS,
  type ActivityCategory,
  type PlatformActivityRow,
  type PlatformPortal,
} from "@/lib/platform-activity-constants"

export type { PlatformActivityRow, PlatformPortal, ActivityCategory }
export { ACTIVITY_ACTIONS, portalLabel, categoryLabel } from "@/lib/platform-activity-constants"

export type PlatformActivityInput = {
  portal: PlatformPortal
  actorType: string
  actorId?: number | null
  actorLabel?: string | null
  actorEmail?: string | null
  action: string
  category?: ActivityCategory
  entityType?: string | null
  entityId?: string | number | null
  courseId?: number | null
  path?: string | null
  method?: string | null
  success?: boolean
  summary?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export function getRequestActivityContext(request: NextRequest | Request) {
  const headers = request.headers
  const forwarded = headers.get("x-forwarded-for")
  const ipAddress = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || null
  const userAgent = headers.get("user-agent")
  const path = headers.get("x-activity-path") || new URL(request.url).pathname
  const method = request.method
  return { ipAddress, userAgent, path, method }
}

/** Fire-and-forget platform activity log insert. Never throws. */
export async function logPlatformActivity(input: PlatformActivityInput): Promise<void> {
  try {
    await ensurePlatformActivitySchema()
    const metadata = JSON.stringify(input.metadata ?? {})
    await sql`
      INSERT INTO platform_activity_logs (
        portal, actor_type, actor_id, actor_label, actor_email,
        action, category, entity_type, entity_id, course_id,
        path, method, success, summary, metadata, ip_address, user_agent
      ) VALUES (
        ${input.portal},
        ${input.actorType},
        ${input.actorId ?? null},
        ${input.actorLabel ?? null},
        ${input.actorEmail ?? null},
        ${input.action},
        ${input.category ?? "general"},
        ${input.entityType ?? null},
        ${input.entityId != null ? String(input.entityId) : null},
        ${input.courseId ?? null},
        ${input.path ?? null},
        ${input.method ?? null},
        ${input.success !== false},
        ${input.summary ?? null},
        ${metadata}::jsonb,
        ${input.ipAddress ?? null},
        ${input.userAgent ?? null}
      )
    `
  } catch (e) {
    console.warn("[platform-activity] log failed", e)
  }
}

export async function logPlatformActivityFromRequest(
  request: NextRequest | Request,
  input: Omit<PlatformActivityInput, "ipAddress" | "userAgent" | "path" | "method"> &
    Partial<Pick<PlatformActivityInput, "path" | "method">>,
) {
  const ctx = getRequestActivityContext(request)
  await logPlatformActivity({
    ...input,
    path: input.path ?? ctx.path,
    method: input.method ?? ctx.method,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  })
}
