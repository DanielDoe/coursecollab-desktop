"use client"

import Link from "next/link"
import { CreditCard } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionEmptyState,
  InstitutionKeyValueList,
  InstitutionSectionCard,
  InstitutionStatusBadge,
} from "@/components/institution/portal/InstitutionPortalUi"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type BillingPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/billing").getInstitutionBillingModule>> & {
  canManageContact?: boolean
}

export default function InstitutionBillingPage() {
  const { data, loading, error } = useInstitutionJson<BillingPayload>("/api/institution/billing")

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  if (!data?.contract) {
    return (
      <InstitutionModulePage>
        <InstitutionEmptyState
          title="No active contract"
          body="Commercial billing details appear once your institutional license is activated."
          actionLabel="View license"
          actionHref={`${INSTITUTION_DASHBOARD_BASE}/license`}
        />
      </InstitutionModulePage>
    )
  }

  const s = data.summary
  const c = data.contract

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        <InstitutionSectionCard title="Billing summary" hint="Commercial terms — product access is on the License page">
          <InstitutionKeyValueList
            rows={[
              { label: "Plan", value: s.planName ?? "—" },
              { label: "Annual contract value", value: s.annualContractValue ?? "—" },
              { label: "Billing method", value: s.billingMethod ?? "—" },
              { label: "Payment terms", value: s.paymentTerms ?? "—" },
              {
                label: "Contract status",
                value: <InstitutionStatusBadge label={s.contractStatus ?? "—"} tone="info" />,
              },
              { label: "Renewal", value: s.renewalDate ?? "—" },
              { label: "Days remaining", value: s.daysRemaining != null ? String(s.daysRemaining) : "—" },
            ]}
          />
        </InstitutionSectionCard>

        <InstitutionSectionCard title="Contract information">
          <InstitutionKeyValueList
            rows={[
              { label: "Contract ID", value: String(c.id) },
              { label: "Plan", value: c.planId },
              { label: "Start", value: c.startDate ?? "—" },
              { label: "End", value: c.endDate ?? "—" },
              { label: "Term", value: `${c.termMonths} months` },
              { label: "List price", value: c.listPrice ?? "—" },
              { label: "Negotiated price", value: c.negotiatedPrice ?? "—" },
              { label: "PO number", value: c.poNumber ?? "—" },
            ]}
          />
        </InstitutionSectionCard>

        {data.history.length > 0 ? (
          <InstitutionSectionCard title="Billing history">
            <ul className="divide-y divide-[var(--border)] text-sm">
              {data.history.map((h, i) => (
                <li key={`${h.action}-${i}`} className="flex justify-between py-2">
                  <span className={PORTAL_TEXT}>{h.action.replaceAll("_", " ")}</span>
                  <span className={PORTAL_TEXT_MUTED}>{h.at.slice(0, 10)}</span>
                </li>
              ))}
            </ul>
          </InstitutionSectionCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href={`${INSTITUTION_DASHBOARD_BASE}/invoices`} className={cn(PORTAL_CTA, "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm")}>
            <CreditCard className="size-4" />
            View invoices
          </Link>
          <a href="/institutions/request-quote" className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
            Request renewal / upgrade
          </a>
        </div>
      </div>
    </InstitutionModulePage>
  )
}
