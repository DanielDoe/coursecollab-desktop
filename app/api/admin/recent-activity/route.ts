import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensurePlatformActivitySchema } from "@/lib/ensure-platform-activity-schema"
import { categoryLabel, portalLabel } from "@/lib/platform-activity-constants"

type ActivityItem = {
  id: string
  type: string
  title: string
  description?: string
  message?: string
  timestamp?: string
  created_at?: string
  status?: string
  portal?: string
  category?: string
  action?: string
  actor_label?: string
}

function humanizeAction(action: string) {
  return action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId

    const activities: ActivityItem[] = []

    await ensurePlatformActivitySchema()
    try {
      const platformLogs = await sql`
        SELECT
          l.id,
          l.portal,
          l.actor_type,
          COALESCE(l.actor_label, s.full_name, NULLIF(l.metadata->>'fullName', '')) AS actor_label,
          COALESCE(l.actor_email, s.email) AS actor_email,
          COALESCE(s.student_id, NULLIF(l.metadata->>'studentId', '')) AS actor_student_id,
          l.action,
          l.category,
          l.summary,
          l.success,
          l.path,
          l.created_at
        FROM platform_activity_logs l
        LEFT JOIN students s
          ON l.actor_type = 'student'
         AND s.deleted_at IS NULL
         AND (
           l.actor_id = s.id
           OR TRIM(s.student_id) = TRIM(l.actor_id::text)
         )
        ORDER BY l.created_at DESC
        LIMIT 12
      `
      for (const row of platformLogs as {
        id: number
        portal: string
        actor_type: string
        actor_label: string | null
        actor_email: string | null
        actor_student_id: string | null
        action: string
        category: string
        summary: string | null
        success: boolean
        path: string | null
        created_at: string
      }[]) {
        const actor =
          row.actor_label ||
          row.actor_email ||
          row.actor_student_id ||
          row.actor_type
        const actorWithId =
          row.actor_label && row.actor_student_id
            ? `${row.actor_label} (${row.actor_student_id})`
            : actor
        const detail =
          row.summary ||
          [portalLabel(row.portal), categoryLabel(row.category), row.path].filter(Boolean).join(" · ")
        activities.push({
          id: `platform-${row.id}`,
          type: "audit",
          title: `${humanizeAction(row.action)}${actorWithId ? ` · ${actorWithId}` : ""}`,
          description: detail,
          message: detail,
          timestamp: row.created_at,
          created_at: row.created_at,
          status: row.success ? "success" : "failed",
          portal: row.portal,
          category: row.category,
          action: row.action,
          actor_label: actorWithId,
        })
      }
    } catch (e) {
      console.warn("[Admin recent-activity] platform logs failed:", e)
    }

    try {
      const auditRows = await sql`
        SELECT id, actor_type, action, entity_type, entity_id, metadata, created_at
        FROM audit_logs
        ORDER BY created_at DESC NULLS LAST
        LIMIT 8
      `
      for (const row of auditRows as {
        id: number
        actor_type: string
        action: string
        entity_type: string | null
        entity_id: number | null
        metadata: Record<string, unknown> | null
        created_at: string
      }[]) {
        activities.push({
          id: `audit-${row.id}`,
          type: "rbac_audit",
          title: humanizeAction(row.action),
          description: row.entity_type
            ? `${row.entity_type}${row.entity_id != null ? ` #${row.entity_id}` : ""}`
            : row.actor_type,
          message: row.entity_type
            ? `${row.entity_type}${row.entity_id != null ? ` #${row.entity_id}` : ""}`
            : row.actor_type,
          timestamp: row.created_at,
          created_at: row.created_at,
          actor_label: row.actor_type,
          category: "admin",
        })
      }
    } catch {
      /* audit_logs table may not exist in all envs */
    }

    try {
      const pendingRequests = await sql`
        SELECT id, email, full_name, request_kind, created_at
        FROM account_requests
        WHERE status = 'pending'
        ORDER BY created_at DESC NULLS LAST
        LIMIT 4
      `
      for (const row of pendingRequests as {
        id: number
        email: string
        full_name: string | null
        request_kind: string | null
        created_at: string
      }[]) {
        activities.push({
          id: `request-${row.id}`,
          type: "account_request",
          title: "Pending account request",
          description: row.full_name ? `${row.full_name} (${row.email})` : row.email,
          message: row.request_kind ? `Type: ${row.request_kind}` : undefined,
          timestamp: row.created_at,
          created_at: row.created_at,
          status: "pending",
          category: "admin",
        })
      }
    } catch (e) {
      console.warn("[Admin recent-activity] account requests failed:", e)
    }

    activities.sort(
      (a, b) =>
        new Date(b.timestamp ?? b.created_at ?? 0).getTime() -
        new Date(a.timestamp ?? a.created_at ?? 0).getTime(),
    )

    const recentActivity = activities.slice(0, 12)
    return NextResponse.json({ activities: recentActivity, recentActivity })
  } catch (error) {
    console.error("Failed to fetch recent activity:", error)
    return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 })
  }
}
