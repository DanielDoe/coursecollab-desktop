import { sql } from "@/lib/db"
import { ensureInstitutionSchema } from "@/lib/ensure-institution-schema"
import { activateInstitutionLicense } from "@/lib/institutions/licenses"
import { recordInstitutionAudit } from "@/lib/institutions/audit"
import type Stripe from "stripe"

export async function handleInstitutionCheckoutCompleted(session: Stripe.Checkout.Session) {
  await ensureInstitutionSchema()
  const institutionId = Number(session.metadata?.institutionId)
  const planId = String(session.metadata?.planId ?? "")
  if (!Number.isFinite(institutionId) || institutionId < 1 || !planId) return

  const rows = await sql`
    SELECT id FROM institution_licenses
    WHERE institution_id = ${institutionId}
      AND stripe_subscription_id = ${session.id}
    LIMIT 1
  `
  const licenseId = rows[0]?.id != null ? Number(rows[0].id) : null
  if (!licenseId) return

  const start = new Date()
  const end = new Date()
  end.setFullYear(end.getFullYear() + 1)
  await sql`
    UPDATE institution_licenses
    SET start_date = ${start.toISOString().slice(0, 10)},
        end_date = ${end.toISOString().slice(0, 10)},
        stripe_customer_id = ${typeof session.customer === "string" ? session.customer : null},
        updated_at = NOW()
    WHERE id = ${licenseId}
  `
  await activateInstitutionLicense({
    licenseId,
    reason: "stripe_checkout",
  })
  await recordInstitutionAudit({
    institutionId,
    action: "license_activated",
    entityType: "institution_license",
    entityId: licenseId,
    newValue: { planId, checkoutSessionId: session.id },
    reason: "stripe_checkout",
  })
}
