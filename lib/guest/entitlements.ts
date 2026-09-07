import { sql } from "@/lib/db"
import type { GuestEntitlementRow, GuestPlan } from "@/lib/guest/types"
import { capabilitiesForGuestPlan } from "@/lib/guest/capabilities"
import { guestPlanHasCareerUnlock } from "@/lib/guest/membership-config"

let schemaReady: Promise<void> | null = null

export async function ensureGuestEntitlementsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS guest_entitlements (
          student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
          plan VARCHAR(40) NOT NULL DEFAULT 'guest_free',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ,
          cora_credit_limit INTEGER,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_guest_entitlements_plan
        ON guest_entitlements (plan, status)
      `
    })()
  }
  await schemaReady
}

function normalizePlan(raw: unknown): GuestPlan {
  if (raw === "cora_career" || raw === "cora_career_essentials") return raw
  return "guest_free"
}

function isActiveEntitlement(row: GuestEntitlementRow): boolean {
  if (row.status === "refunded" || row.status === "revoked") return false
  if (guestPlanHasCareerUnlock(normalizePlan(row.plan))) return row.status === "active"
  return row.status === "active"
}

export async function getGuestEntitlement(studentId: number): Promise<GuestEntitlementRow | null> {
  await ensureGuestEntitlementsSchema()
  const rows = (await sql`
    SELECT student_id, plan, status, starts_at, expires_at, cora_credit_limit, updated_at
    FROM guest_entitlements
    WHERE student_id = ${studentId}
    LIMIT 1
  `) as GuestEntitlementRow[]
  return rows[0] ?? null
}

/** Ensure every platform guest has Guest Free entitlements. */
export async function ensureGuestFreeEntitlement(studentId: number): Promise<GuestEntitlementRow> {
  await ensureGuestEntitlementsSchema()
  const existing = await getGuestEntitlement(studentId)
  if (existing) return existing

  const rows = (await sql`
    INSERT INTO guest_entitlements (student_id, plan, status)
    VALUES (${studentId}, 'guest_free', 'active')
    ON CONFLICT (student_id) DO NOTHING
    RETURNING student_id, plan, status, starts_at, expires_at, cora_credit_limit, updated_at
  `) as GuestEntitlementRow[]

  if (rows[0]) {
    void import("@/lib/guest/cora-credits").then(({ grantGuestIncludedCredits }) =>
      grantGuestIncludedCredits(studentId, "guest_free"),
    )
    return rows[0]
  }
  const again = await getGuestEntitlement(studentId)
  if (!again) throw new Error("Failed to create guest entitlement")
  void import("@/lib/guest/cora-credits").then(({ grantGuestIncludedCredits }) =>
    grantGuestIncludedCredits(studentId, "guest_free"),
  )
  return again
}

/** Sync onboarding fields into guest_profiles (idempotent). */
export async function ensureGuestProfile(
  studentId: number,
  fields?: { onboardingPurpose?: string | null; organization?: string | null },
): Promise<void> {
  await ensureGuestEntitlementsSchema()
  await sql`
    CREATE TABLE IF NOT EXISTS guest_profiles (
      student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      onboarding_purpose VARCHAR(40),
      organization TEXT,
      career_context JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  if (fields) {
    await sql`
      INSERT INTO guest_profiles (student_id, onboarding_purpose, organization)
      VALUES (${studentId}, ${fields.onboardingPurpose ?? null}, ${fields.organization ?? null})
      ON CONFLICT (student_id) DO UPDATE SET
        onboarding_purpose = COALESCE(EXCLUDED.onboarding_purpose, guest_profiles.onboarding_purpose),
        organization = COALESCE(EXCLUDED.organization, guest_profiles.organization),
        updated_at = NOW()
    `
    return
  }
  await sql`
    INSERT INTO guest_profiles (student_id, onboarding_purpose, organization)
    SELECT id, guest_access_purpose, guest_organization
    FROM students
    WHERE id = ${studentId} AND is_platform_guest = true
    ON CONFLICT (student_id) DO UPDATE SET
      onboarding_purpose = COALESCE(EXCLUDED.onboarding_purpose, guest_profiles.onboarding_purpose),
      organization = COALESCE(EXCLUDED.organization, guest_profiles.organization),
      updated_at = NOW()
  `
}

export async function resolveGuestCapabilities(studentId: number) {
  const entitlement = await ensureGuestFreeEntitlement(studentId)
  const active = isActiveEntitlement(entitlement)
  const plan = active ? normalizePlan(entitlement.plan) : ("guest_free" as GuestPlan)
  return {
    plan,
    status: active ? entitlement.status : ("refunded" as const),
    coraCareerLifetime: active && guestPlanHasCareerUnlock(plan),
    capabilities: capabilitiesForGuestPlan(plan),
    entitlement,
  }
}

export async function guestHasCapabilityForStudent(
  studentId: number,
  capability: import("@/lib/guest/types").GuestCapability,
): Promise<boolean> {
  const { capabilities } = await resolveGuestCapabilities(studentId)
  const { guestHasCapability } = await import("@/lib/guest/capabilities")
  return guestHasCapability(capabilities, capability)
}
