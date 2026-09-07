"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BarChart3, FileText, GraduationCap, Sparkles, Users } from "lucide-react"
import { useInstitutionDashboard } from "@/components/institution/InstitutionDashboardContext"
import { DataFreshness } from "@/components/institution/InstitutionMetricTooltip"
import { INSTITUTION_DASHBOARD_BASE } from "@/lib/institution-portal-nav-config"
import type { InstitutionDashboardMetrics } from "@/lib/institutions/metrics/types"
import { cn } from "@/lib/utils"

function greetingPrefix(hour: number): string {
  if (hour < 5) return "Late night"
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatToday(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  })
}

const LAUNCHERS = [
  { href: `${INSTITUTION_DASHBOARD_BASE}/license`, label: "License", icon: FileText },
  { href: `${INSTITUTION_DASHBOARD_BASE}/faculty`, label: "Faculty", icon: GraduationCap },
  { href: `${INSTITUTION_DASHBOARD_BASE}/students`, label: "Students", icon: Users },
  { href: `${INSTITUTION_DASHBOARD_BASE}/cora`, label: "Cora", icon: Sparkles },
  { href: `${INSTITUTION_DASHBOARD_BASE}/analytics`, label: "Analytics", icon: BarChart3 },
] as const

export function InstitutionDashboardHero({ data }: { data: InstitutionDashboardMetrics }) {
  const { role } = useInstitutionDashboard()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const planLine = [
    data.header.planName ?? "No active plan",
    data.header.licenseStatus
      ? data.header.licenseStatus.charAt(0).toUpperCase() + data.header.licenseStatus.slice(1)
      : "Pending",
    data.header.contractPeriod,
  ]
    .filter(Boolean)
    .join(" · ")

  const capacityLine =
    data.header.activeLearnerCapacity != null
      ? `${data.header.activeLearners.toLocaleString()} / ${data.header.activeLearnerCapacity.toLocaleString()} active learners`
      : `${data.header.activeLearners.toLocaleString()} active learners`

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-[var(--cc-text-secondary)]">{data.header.institutionName}</span>
            {role ? (
              <span className="text-[11px] font-medium capitalize text-[var(--cc-text-muted)]">· {role}</span>
            ) : null}
            <span className="text-[11px] font-medium text-[var(--cc-text-muted)]">· {formatToday(now)}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cc-text)] sm:text-2xl">
            {greetingPrefix(now.getHours())}
          </h1>
          <p className="mt-1 text-sm text-[var(--cc-text-muted)]">{planLine}</p>
          <p className="mt-0.5 text-sm tabular-nums text-[var(--cc-text-secondary)]">{capacityLine}</p>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <DataFreshness generatedAt={data.generatedAt} />
          <div className="flex flex-wrap items-center gap-2">
            {LAUNCHERS.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--background)]/80 px-3.5 text-sm font-medium text-[var(--cc-text)]",
                    "transition-colors hover:border-[color-mix(in_srgb,var(--cc-accent)_40%,var(--border))] hover:bg-[var(--cc-accent-soft)]",
                  )}
                >
                  <Icon className="size-4 text-[var(--cc-accent-dark)]" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
