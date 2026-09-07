import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAdminId } from "@/lib/admin-api-auth"
import { ensureScheduleAdjustmentSchema } from "@/lib/ensure-schedule-adjustment-schema"

export const dynamic = "force-dynamic"

/** Admin-only platform setting for schedule change consent threshold. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response

  await ensureScheduleAdjustmentSchema()
  const rows = await sql`
    SELECT value FROM platform_config WHERE key = 'schedule_change_consent_threshold' LIMIT 1
  `
  const raw = rows[0]?.value
  const threshold =
    typeof raw === "number"
      ? raw
      : raw && typeof raw === "object" && raw !== null && "percent" in raw
        ? Number((raw as { percent: unknown }).percent)
        : Number(raw)
  return NextResponse.json({
    success: true,
    scheduleChangeConsentThreshold: Number.isFinite(threshold) ? threshold : 50,
  })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminId(request)
  if (!auth.ok) return auth.response

  const body = await request.json()
  const threshold = Number(body.scheduleChangeConsentThreshold)
  if (!Number.isFinite(threshold) || threshold < 1 || threshold > 100) {
    return NextResponse.json({ error: "Threshold must be 1–100" }, { status: 400 })
  }

  await ensureScheduleAdjustmentSchema()
  await sql`
    INSERT INTO platform_config (key, value, updated_at)
    VALUES ('schedule_change_consent_threshold', ${JSON.stringify({
      percent: threshold,
      updatedBy: auth.adminId,
    })}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value,
      updated_at = NOW()
  `

  return NextResponse.json({ success: true, scheduleChangeConsentThreshold: threshold })
}
