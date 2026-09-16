"use client"

import Link from "next/link"
import { useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, Battery, Gauge, Sparkles, Users } from "lucide-react"
import { InstitutionModulePage, useInstitutionJson } from "@/components/institution/institution-page"
import {
  InstitutionChartCard,
  CoraActivityChart,
  MixPieChart,
  NamedBarChart,
  SeatRadial,
} from "@/components/institution/institution-charts"
import { InsufficientMetric } from "@/components/institution/InstitutionResearchUi"
import {
  InstitutionDataTable,
  InstitutionEmptyState,
  InstitutionKpiGrid,
  InstitutionSectionCard,
} from "@/components/institution/portal/InstitutionPortalUi"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import {
  INSTITUTION_CORA_SECTIONS,
  parseInstitutionCoraSection,
  type InstitutionCoraSection,
} from "@/lib/institution-cora-nav-config"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type CoraPayload = Awaited<ReturnType<typeof import("@/lib/institutions/portal/cora").getInstitutionCoraModule>>
type AnalyticsPayload = import("@/lib/institutions/metrics/types").InstitutionAnalyticsMetrics

export function InstitutionCoraUsageHub() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const section = parseInstitutionCoraSection(searchParams.get("view"))
  const { data, loading, error } = useInstitutionJson<CoraPayload>("/api/institution/cora")
  const analytics = useInstitutionJson<AnalyticsPayload>(
    "/api/institution/analytics?tab=cora&preset=last_30_days",
  )
  const coraAnalytics = analytics.data?.cora
  const assist = coraAnalytics?.assistance
  const link = coraAnalytics?.linkage

  const sync = useCallback(
    (next: InstitutionCoraSection) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("view", next)
      router.replace(`/institution/dashboard/cora?${params.toString()}`, { scroll: false })
    },
    [router, searchParams],
  )

  if (loading) return <InstitutionModulePage><p className={PORTAL_TEXT_MUTED}>Loading…</p></InstitutionModulePage>
  if (error) return <InstitutionModulePage><p className="text-sm text-[var(--cc-danger)]">{error}</p></InstitutionModulePage>

  const k = data?.kpis
  const allowance = data?.allowance
  const triggered = (data?.alerts ?? []).filter((a) => a.triggered)
  const studentCredits = (data?.byRole ?? []).filter((r) => r.role === "student").reduce((s, r) => s + r.credits, 0)
  const facultyCredits = (data?.byRole ?? []).filter((r) => r.role === "instructor").reduce((s, r) => s + r.credits, 0)
  const workflows = k?.workflows ?? 0

  return (
    <InstitutionModulePage>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {INSTITUTION_CORA_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => sync(item.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium",
                section === item.id
                  ? "bg-[var(--cc-accent)] text-white"
                  : "border border-[var(--border)] text-[var(--cc-text-muted)] hover:bg-[var(--muted)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {triggered.length > 0 && section === "costs" ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className={PORTAL_TEXT}>
              Cora allowance has reached {triggered[triggered.length - 1]?.threshold}% of included credits.
            </p>
          </div>
        ) : null}

        {section === "usage" ? (
          <>
            {k ? (
              <InstitutionKpiGrid
                items={[
                  { label: "Sessions / workflows", value: k.workflows, sub: "Recorded Cora jobs", icon: Sparkles, valueKind: "count" },
                  { label: "Active users", value: k.activeUsers, sub: "Distinct Cora users", icon: Users, valueKind: "count" },
                  { label: "Credits used", value: k.creditsUsed, sub: "Operational pool", icon: Gauge },
                  { label: "Credits remaining", value: k.creditsRemaining, sub: allowance?.resetDate ? `Resets ${allowance.resetDate}` : "Allowance", icon: Battery },
                ]}
              />
            ) : null}
            <InstitutionChartCard title="Consumption over time" hint="Weekly institutional usage">
              <CoraActivityChart
                data={(data?.weekly ?? []).map((w) => ({
                  week: w.week,
                  label: w.week.slice(5),
                  credits: w.credits,
                  workflows: 0,
                  activeUsers: 0,
                }))}
                hasActivity={(data?.weekly ?? []).some((w) => w.credits > 0)}
              />
            </InstitutionChartCard>
            <InstitutionChartCard title="By user type">
              <MixPieChart
                data={(data?.byRole ?? []).map((r) => ({
                  key: r.role,
                  name: r.role === "instructor" ? "Instructors" : r.role === "student" ? "Students" : r.role,
                  value: r.workflows,
                }))}
                empty="No usage by role yet"
              />
            </InstitutionChartCard>
          </>
        ) : null}

        {section === "assistance" ? (
          <div className="space-y-3">
            {assist ? (
              <InstitutionChartCard title="Assistance proxy" hint={assist.proxyNote}>
                <NamedBarChart data={assist.assistanceProxy} empty="No Cora sessions in this period" valueLabel="Sessions" />
              </InstitutionChartCard>
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading assistance analytics…</p>
            )}
            {coraAnalytics?.classified?.available ? (
              <InstitutionChartCard title="Assistance depth (inferred)" hint={coraAnalytics.classified.note}>
                <NamedBarChart data={coraAnalytics.classified.byDepth} empty="No depth data" valueLabel="Interactions" />
              </InstitutionChartCard>
            ) : (
              <InsufficientMetric
                title="Assistance depth"
                reason="Insufficient data"
                unblock="Depth levels 0–5 populate from classified Cora interactions. Need at least 10 in this period."
              />
            )}
          </div>
        ) : null}

        {section === "learning_connections" ? (
          <div className="space-y-3">
            {link ? (
              <>
                <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>{link.associationNote}</p>
                <p className={cn("text-sm", PORTAL_TEXT)}>
                  {link.practiceFollow24hRate != null
                    ? `${link.practiceFollow24hRate}% of Cora sessions were followed by practice within 24 hours (N = ${link.windowNs.practice24h}).`
                    : "Insufficient data to estimate 24-hour practice follow-through."}
                </p>
                <p className={cn("text-sm", PORTAL_TEXT)}>
                  {link.meanAssessmentScoreAfter7d != null
                    ? `Mean assessment score within 7 days after Cora: ${link.meanAssessmentScoreAfter7d}% (N = ${link.windowNs.assessment7d}).`
                    : "Insufficient data for a 7-day subsequent assessment score."}
                </p>
              </>
            ) : (
              <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading learning connections…</p>
            )}
            <Link href={`${INSTITUTION_DASHBOARD_BASE}/analytics?section=ai_assistance`} className="text-sm font-medium text-[var(--cc-accent-dark)]">
              Open full AI Assistance analytics →
            </Link>
          </div>
        ) : null}

        {section === "patterns" ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {coraAnalytics?.assistance ? (
              <>
                <InstitutionChartCard title="Use by hour (UTC)">
                  <NamedBarChart data={coraAnalytics.assistance.byHour} empty="No hourly activity" valueLabel="Sessions" />
                </InstitutionChartCard>
                <InstitutionChartCard title="Use by weekday (UTC)">
                  <NamedBarChart data={coraAnalytics.assistance.byWeekday} empty="No weekday activity" valueLabel="Sessions" />
                </InstitutionChartCard>
              </>
            ) : null}
            {coraAnalytics?.temporal ? (
              <InstitutionChartCard title="Deadline proximity" hint={coraAnalytics.temporal.note}>
                <NamedBarChart
                  data={coraAnalytics.temporal.deadlineProximity}
                  empty="No linked due dates"
                  valueLabel="Sessions"
                />
              </InstitutionChartCard>
            ) : (
              <InsufficientMetric
                title="Timing relative to deadlines"
                reason="Insufficient data"
                unblock="Need session timestamps joined to assignment due dates."
              />
            )}
            {coraAnalytics?.escalation?.available ? (
              <InstitutionChartCard title="Assistance escalation ladder" hint={coraAnalytics.escalation.note}>
                <NamedBarChart data={coraAnalytics.escalation.ladder} empty="No escalation data" valueLabel="Sessions" />
              </InstitutionChartCard>
            ) : (
              <InsufficientMetric
                title="Attempt-before-AI and escalation"
                reason="Insufficient data"
                unblock="Classified Cora interactions accumulate as students use AI on covered courses."
              />
            )}
          </div>
        ) : null}

        {section === "workflows" ? (
          <InstitutionChartCard title="Workflows" hint="Product workflow mix — not educational assistance type">
            <NamedBarChart
              data={(data?.byWorkflow ?? []).slice(0, 12).map((w) => ({ key: w.key, name: w.name, value: w.workflows }))}
              empty="No workflow usage yet"
              valueLabel="Workflows"
            />
          </InstitutionChartCard>
        ) : null}

        {section === "faculty" ? (
          <div className="space-y-3">
            <p className={cn("text-sm leading-relaxed", PORTAL_TEXT_MUTED)}>
              Faculty activity metrics describe platform usage and are not faculty performance evaluations. CourseCollab does not rank faculty.
            </p>
            <InstitutionChartCard title="Faculty vs student credit share">
              <MixPieChart
                data={[
                  { key: "student", name: "Students", value: studentCredits },
                  { key: "instructor", name: "Faculty", value: facultyCredits },
                ]}
                empty="No role-tagged usage yet"
              />
            </InstitutionChartCard>
          </div>
        ) : null}

        {section === "costs" ? (
          <>
            <InstitutionSectionCard title="Credit utilization" hint="Operational allowance — not a learning outcome">
              {allowance && allowance.included > 0 ? (
                <>
                  <SeatRadial used={allowance.used} limit={allowance.included} />
                  <p className={cn("mt-2 text-center text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
                    {allowance.used.toLocaleString()} / {allowance.included.toLocaleString()} credits
                    {allowance.resetDate ? ` · resets ${allowance.resetDate}` : ""}
                  </p>
                </>
              ) : (
                <InstitutionEmptyState title="No Cora allowance" body="Your active license does not include institutional Cora credits yet." />
              )}
            </InstitutionSectionCard>
            <InstitutionKpiGrid
              items={[
                {
                  label: "Credits / active user",
                  value: k && k.activeUsers > 0 ? Math.round(k.creditsUsed / k.activeUsers) : "—",
                  sub: "Operational efficiency",
                  icon: Users,
                },
                {
                  label: "Credits / workflow",
                  value: workflows > 0 && k ? Math.round(k.creditsUsed / workflows) : "—",
                  sub: "Mean debit",
                  icon: Sparkles,
                },
              ]}
            />
          </>
        ) : null}

        {section === "usage" || section === "costs" ? (
          <InstitutionSectionCard
            title="Top Cora consumers"
            actions={
              <Link href={`${INSTITUTION_DASHBOARD_BASE}/analytics?section=ai_assistance`} className="text-xs font-medium text-[var(--cc-accent-dark)]">
                View AI Assistance analytics →
              </Link>
            }
          >
            <InstitutionDataTable
              rows={data?.topConsumers ?? []}
              rowKey={(r) => `${r.role}-${r.userId}`}
              empty={<p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Cora usage recorded yet.</p>}
              columns={[
                { key: "name", label: "User" },
                { key: "role", label: "Role", render: (r) => <span className="capitalize">{r.role}</span> },
                { key: "workflows", label: "Workflows", render: (r) => String(r.workflows) },
                { key: "credits", label: "Credits", render: (r) => r.credits.toLocaleString() },
                { key: "avg", label: "Avg / workflow", render: (r) => String(r.avgCredits) },
              ]}
            />
          </InstitutionSectionCard>
        ) : null}
      </div>
    </InstitutionModulePage>
  )
}
