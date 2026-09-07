"use client"

import Link from "next/link"
import { BookOpen, Calendar, Clock, Gauge, GraduationCap, Users } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionKeyValueList,
  InstitutionSectionCard,
  InstitutionStatusBadge,
} from "@/components/institution/portal/InstitutionPortalUi"
import { UtilizationMeter } from "@/components/institution/institution-charts"
import { SeatRadial } from "@/components/institution/institution-charts"
import { InstitutionPrivacyTrustStrip } from "@/components/institution/InstitutionPrivacyTrustStrip"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import {
  INSTITUTION_SPONSORED_INSTRUCTOR_TIER,
  INSTITUTION_SPONSORED_STUDENT_TIER,
} from "@/lib/entitlements/feature-bundles"

type LicensePayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/license").getInstitutionLicenseModule>>

export default function InstitutionLicensePage() {
  const { data, loading, error } = useInstitutionJson<LicensePayload>("/api/institution/license")

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>
  if (!data?.active) {
    return (
      <InstitutionModulePage>
        <InstitutionEmptyState
          title="No active license"
          body="Your institution contract is not active yet. Request a quote or contact Course Collab to activate coverage."
          actionLabel="Request quote"
          actionHref="/institutions/request-quote"
        />
      </InstitutionModulePage>
    )
  }

  const a = data.active
  const k = data.kpis

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        <InstitutionSectionCard title={a.planName} hint={`${a.contractStatus} · ${a.scopeType} scope`}>
          <InstitutionKeyValueList
            rows={[
              { label: "Status", value: <InstitutionStatusBadge label={a.status} tone={a.status === "active" ? "success" : "warning"} /> },
              { label: "Contract", value: `${a.startDate ?? "—"} – ${a.endDate ?? "—"}` },
              { label: "Renewal", value: a.renewalDate ?? a.endDate ?? "—" },
              { label: "Term", value: `${a.contractTermMonths} months` },
              { label: "Support", value: a.supportLevel },
              { label: "Instructors", value: a.seatLimitInstructors ? String(a.seatLimitInstructors) : "Unlimited within scope" },
            ]}
          />
        </InstitutionSectionCard>

        <InstitutionKpiGrid
          items={[
            {
              label: "Active learners",
              value: k.seatLimit ? `${k.activeLearners} / ${k.seatLimit}` : k.activeLearners,
              sub: k.remainingCapacity != null ? `${k.remainingCapacity} seats left` : "\u00A0",
              icon: Users,
            },
            {
              label: "Utilization",
              value: k.utilizationPct != null ? k.utilizationPct : "—",
              sub: data.utilization.statusLabel,
              icon: Gauge,
              valueKind: "percent",
            },
            {
              label: "Covered faculty",
              value: k.coveredInstructors,
              sub: "Within license scope",
              icon: GraduationCap,
              valueKind: "count",
            },
            {
              label: "Covered courses",
              value: k.coveredCourses,
              sub: "Licensed courses",
              icon: BookOpen,
              valueKind: "count",
            },
            {
              label: "Days remaining",
              value: k.daysRemaining ?? "—",
              sub: a.endDate ? `Until ${a.endDate}` : "\u00A0",
              icon: Calendar,
              valueKind: "count",
            },
            {
              label: "Contract term",
              value: `${a.contractTermMonths} mo`,
              sub: a.contractStatus,
              icon: Clock,
            },
          ]}
        />

        <InstitutionSectionCard title="Capacity utilization" hint={data.utilization.statusLabel}>
          <UtilizationMeter used={k.activeLearners} limit={k.seatLimit} statusLabel={data.utilization.statusLabel} />
        </InstitutionSectionCard>

        <div className="grid gap-4 lg:grid-cols-2">
          <InstitutionSectionCard
            title="Cora allowance"
            actions={
              <Link href={`${INSTITUTION_DASHBOARD_BASE}/cora`} className="text-xs font-medium text-[var(--cc-accent-dark)]">
                View Cora usage →
              </Link>
            }
          >
            <SeatRadial used={data.cora.used} limit={data.cora.included || null} />
            <p className={cn("mt-2 text-center text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
              {data.cora.used.toLocaleString()} / {data.cora.included.toLocaleString()} credits
              {data.cora.resetDate ? ` · resets ${data.cora.resetDate}` : ""}
            </p>
          </InstitutionSectionCard>
          <InstitutionSectionCard title="License scope" hint="Units and courses covered by this contract">
            {data.scope.length === 0 ? (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No scopes configured yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.scope.map((s, i) => (
                  <li key={`${s.type}-${s.courseId ?? s.organizationUnitId ?? i}`} className="flex justify-between gap-2">
                    <span className={PORTAL_TEXT}>{s.label}</span>
                    <InstitutionStatusBadge label={s.type} tone="info" />
                  </li>
                ))}
              </ul>
            )}
          </InstitutionSectionCard>
        </div>

        <InstitutionPrivacyTrustStrip variant="compact" />

        <InstitutionSectionCard title="Sponsored member access" hint="Feature levels applied to students and faculty in license scope">
          <InstitutionKeyValueList
            rows={[
              {
                label: "Students",
                value: `${INSTITUTION_SPONSORED_STUDENT_TIER} learning features (AI tutor, practice hub, CodeBench, etc.)`,
              },
              {
                label: "Faculty",
                value: `${INSTITUTION_SPONSORED_INSTRUCTOR_TIER} teaching features (includes Pro capabilities)`,
              },
            ]}
          />
        </InstitutionSectionCard>

        <InstitutionSectionCard title="Included features">
          <div className="grid gap-4 lg:grid-cols-2">
            {data.featureGroups.map((g) => (
              <div key={g.key}>
                <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>{g.title}</p>
                <ul className="space-y-1 text-sm">
                  {g.features.map((f) => (
                    <li key={f.key} className="flex items-center justify-between gap-2">
                      <span className={PORTAL_TEXT}>{f.label}</span>
                      <InstitutionStatusBadge label={f.included ? "Included" : "—"} tone={f.included ? "success" : "muted"} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </InstitutionSectionCard>

        {data.history.length > 1 ? (
          <InstitutionSectionCard title="License history">
            <ul className="divide-y divide-[var(--border)] text-sm">
              {data.history.map((h) => (
                <li key={h.id} className="flex justify-between py-2">
                  <span className={PORTAL_TEXT}>{h.planId} · {h.contractStatus}</span>
                  <span className={PORTAL_TEXT_MUTED}>{h.startDate ?? "—"} – {h.endDate ?? "—"}</span>
                </li>
              ))}
            </ul>
          </InstitutionSectionCard>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <a href="/institutions/request-quote" className={cn(PORTAL_CTA, "rounded-xl px-4 py-2 text-sm")}>
            Request capacity / upgrade
          </a>
          <Link href={`${INSTITUTION_DASHBOARD_BASE}/billing`} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm">
            View billing
          </Link>
        </div>
      </div>
    </InstitutionModulePage>
  )
}
