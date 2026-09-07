import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { findInstructorCoveredLicenses, findStudentCoveredLicenses } from "@/lib/institutions/coverage"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import { institutionDebitApplied } from "@/lib/institutions/cora-spend"
import type { EntitlementContext } from "@/lib/entitlements/types"

export async function getCoraAllowance(
  userType: "student" | "instructor",
  userId: number,
  context: EntitlementContext = {},
) {
  const licenses =
    userType === "student"
      ? await findStudentCoveredLicenses(userId, context)
      : await findInstructorCoveredLicenses(userId, context)
  const license = licenses[0]
  if (!license) {
    return {
      institutionPool: null as null | {
        institutionId: number
        licenseId: number
        included: number
        used: number
        remaining: number
      },
    }
  }
  await ensureInstitutionSchema()
  const rows = await sql`
    SELECT included_credits, used_credits
    FROM institution_cora_allowances
    WHERE license_id = ${license.licenseId}
    LIMIT 1
  `
  const included = Number(rows[0]?.included_credits ?? license.includedCoraCredits ?? 0)
  const used = Number(rows[0]?.used_credits ?? 0)
  return {
    institutionPool: {
      institutionId: license.institutionId,
      licenseId: license.licenseId,
      included,
      used,
      remaining: Math.max(0, included - used),
    },
  }
}

/**
 * Debit the campus Cora pool when the user is covered.
 * Success means the allowance row actually decremented — never treat a
 * missing row or zero charge as "institution paid" (that skipped personal
 * metering and made institution cover look unlimited).
 */
export async function tryDebitInstitutionCora(input: {
  userType: "student" | "instructor"
  userId: number
  credits: number
  context?: EntitlementContext
  workflowType?: string
  model?: string | null
  estimatedCostUsd?: number
}): Promise<boolean> {
  if (!Number.isFinite(input.credits) || input.credits <= 0) return false
  const allowance = await getCoraAllowance(input.userType, input.userId, input.context)
  const pool = allowance.institutionPool
  if (!pool || pool.included <= 0 || pool.remaining < input.credits) return false

  const existing = (await sql`
    SELECT id FROM institution_cora_allowances
    WHERE license_id = ${pool.licenseId}
    LIMIT 1
  `) as Array<{ id: number }>
  if (existing.length === 0) {
    await sql`
      INSERT INTO institution_cora_allowances (
        institution_id, license_id, included_credits, used_credits
      ) VALUES (
        ${pool.institutionId}, ${pool.licenseId}, ${pool.included}, 0
      )
    `
  }

  const updated = (await sql`
    UPDATE institution_cora_allowances
    SET used_credits = used_credits + ${input.credits}, updated_at = NOW()
    WHERE license_id = ${pool.licenseId}
      AND (included_credits - used_credits) >= ${input.credits}
    RETURNING id
  `) as Array<{ id: number }>
  if (!institutionDebitApplied(updated.length)) return false

  const inserted = (await sql`
    INSERT INTO institution_cora_usage (
      institution_id, license_id, user_type, user_id, course_id, workflow_type, model, credits, estimated_cost_usd
    ) VALUES (
      ${pool.institutionId},
      ${pool.licenseId},
      ${input.userType},
      ${input.userId},
      ${input.context?.courseId ?? null},
      ${input.workflowType ?? "cora"},
      ${input.model ?? null},
      ${input.credits},
      ${input.estimatedCostUsd ?? null}
    )
    RETURNING id
  `) as Array<{ id: number }>
  const usageId = Number(inserted[0]?.id ?? 0)
  const { recordCoraAnalyticsEvents } = await import("@/lib/institutions/analytics-events")
  await recordCoraAnalyticsEvents({
    institutionId: pool.institutionId,
    userId: input.userId,
    userType: input.userType,
    courseId: input.context?.courseId ?? null,
    workflowType: input.workflowType ?? "cora",
    credits: input.credits,
    model: input.model ?? null,
  })
  if (usageId > 0) {
    await sql`
      INSERT INTO cora_usage_events (institution_id, usage_id, user_type, user_id, course_id, workflow_type)
      VALUES (
        ${pool.institutionId}, ${usageId}, ${input.userType}, ${input.userId},
        ${input.context?.courseId ?? null}, ${input.workflowType ?? "cora"}
      )
    `.catch(() => undefined)
  }
  return true
}

export async function grantInstitutionCoraCredits(input: {
  licenseId: number
  credits: number
  actorUserId?: number
  reason?: string
}) {
  await ensureInstitutionSchema()
  await sql`
    UPDATE institution_cora_allowances
    SET included_credits = included_credits + ${input.credits}, updated_at = NOW()
    WHERE license_id = ${input.licenseId}
  `
  const row = await sql`SELECT institution_id FROM institution_licenses WHERE id = ${input.licenseId} LIMIT 1`
  await recordInstitutionAudit({
    institutionId: row[0] ? Number(row[0].institution_id) : null,
    actorUserId: input.actorUserId ?? null,
    action: "cora_credits_modified",
    entityType: "institution_cora_allowance",
    entityId: input.licenseId,
    newValue: { granted: input.credits },
    reason: input.reason ?? null,
  })
}
