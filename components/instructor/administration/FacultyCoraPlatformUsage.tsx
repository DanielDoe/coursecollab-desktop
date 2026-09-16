"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { GraduationCap, RefreshCw, Sparkles } from "lucide-react"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPolicySurfaceCard } from "@/components/instructor/InstructorPolicySurfaceCard"
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome"
import { CORA_NAME, FACULTY_CORA_NAV_LABEL } from "@/lib/cora/constants"
import { FACULTY_CORA_CAPABILITIES } from "@/lib/cora/faculty-capabilities"
import { portalListStripe } from "@/lib/portal-module-themes"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { CoraSectionTools } from "@/components/instructor/administration/CoraSectionTools"
import { Button } from "@/components/ui/button"

type SurfaceRow = {
  id: string
  label: string
  where: string
  uses: string
  events: number
}

type FeatureRow = {
  feature: string
  label: string
  events: number
  users?: number
  credits?: number
}

type UsagePayload = {
  student: {
    conversations30d: number
    activeStudents7d: number
    bySource: Array<{ source: string; label: string; questions: number; students: number }>
    byFeature: FeatureRow[]
    surfaces: SurfaceRow[]
  }
  faculty: {
    threads: number
    events30d: number
    credits30d: number
    byFeature: FeatureRow[]
    byCapability: Array<{ capability: string; threads: number }>
    surfaces: SurfaceRow[]
  }
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-xl font-semibold tabular-nums", PORTAL_TEXT)}>{value}</p>
      <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{label}</p>
    </div>
  )
}

function SurfaceList({
  rows,
  search,
}: {
  rows: SurfaceRow[]
  search: string
}) {
  const filtered = rows.filter(
    (row) =>
      !search ||
      row.label.toLowerCase().includes(search) ||
      row.where.toLowerCase().includes(search) ||
      row.uses.toLowerCase().includes(search),
  )
  if (filtered.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No surfaces match this filter.</p>
  }
  return (
    <div className="divide-y divide-[var(--border)]">
      {filtered.map((row, index) => {
        const stripe = portalListStripe(index, "amber")
        return (
          <div key={row.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div
              className={cn(
                "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                stripe.iconBg,
                stripe.iconText,
              )}
            >
              {row.events}
            </div>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{row.label}</p>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>{row.where}</p>
              <p className={cn("mt-1 text-xs leading-relaxed", PORTAL_TEXT)}>{row.uses}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FeatureList({ rows }: { rows: FeatureRow[] }) {
  if (rows.length === 0) {
    return <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No Cora usage recorded in the last 30 days.</p>
  }
  const max = Math.max(...rows.map((row) => row.events), 1)
  return (
    <div className="divide-y divide-[var(--border)]">
      {rows.map((row) => (
        <div key={row.feature} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{row.label}</p>
            <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
              {row.events} events
              {row.users != null ? ` · ${row.users} users` : ""}
            </p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--cc-accent)]"
              style={{ width: `${Math.max(6, Math.round((row.events / max) * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function FacultyCoraPlatformUsage({
  searchQuery = "",
  onMeta,
}: {
  searchQuery?: string
  onMeta?: (line: string) => void
}) {
  const chrome = facultyEmbedChrome("ai-assistant-settings")
  const [data, setData] = useState<UsagePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState(searchQuery)
  const search = filter.trim().toLowerCase()

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    try {
      const response = await instructorApiFetch("/api/instructor/cora/platform-usage", {
        headers: buildInstructorApiHeaders(),
      })
      const json = (await response.json()) as UsagePayload
      if (response.ok) {
        setData(json)
        onMeta?.(
          `${json.student.activeStudents7d} students · ${json.student.conversations30d} assistant turns · ${json.faculty.threads} copilot threads`,
        )
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onMeta])

  useEffect(() => {
    void load()
  }, [load])

  const capabilityLookup = useMemo(
    () => Object.fromEntries(FACULTY_CORA_CAPABILITIES.map((cap) => [cap.id, cap.title])),
    [],
  )

  if (loading || !data) {
    return <InstructorPolicyLoadingState moduleId="ai-assistant-settings" label="Loading Cora usage…" />
  }

  return (
    <div className="space-y-4">
      <CoraSectionTools
        search={filter}
        onSearchChange={setFilter}
        searchPlaceholder="Filter Cora surfaces…"
        trailing={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Refresh Cora usage"
            disabled={refreshing}
            onClick={() => void load(true)}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />
      <InstructorPolicySurfaceCard
        variant="section"
        title="How Cora is used"
        description={`${CORA_NAME} is two products on this course: student ${CORA_NAME} Assistant and faculty ${FACULTY_CORA_NAV_LABEL}. Counts below are live for the last 30 days.`}
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Student turns (30d)" value={data.student.conversations30d} />
          <Stat label="Active students (7d)" value={data.student.activeStudents7d} />
          <Stat label="Copilot threads" value={data.faculty.threads} />
          <Stat label="Copilot events (30d)" value={data.faculty.events30d} />
        </div>
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        variant="section"
        title={`${CORA_NAME} Assistant — student surfaces`}
        description="Where students open Cora across the portal. The number is conversation or usage events on that surface."
      >
        <div className="mb-3 flex items-center gap-2">
          <div className={cn("flex size-9 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
            <GraduationCap className="h-4 w-4" />
          </div>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Guided problem-solving, lectures, practice, assessments, and study tools.
          </p>
        </div>
        <SurfaceList rows={data.student.surfaces} search={search} />
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        variant="section"
        title={`${FACULTY_CORA_NAV_LABEL} — faculty surfaces`}
        description="Where the teaching copilot authors, analyzes, and proposes course actions. Writes still require confirmation cards."
      >
        <div className="mb-3 flex items-center gap-2">
          <div className={cn("flex size-9 items-center justify-center rounded-lg", chrome.p.softBg, chrome.p.iconText)}>
            <Sparkles className="h-4 w-4" />
          </div>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Question bank, assessments, lectures, announcements, and class insights.
          </p>
        </div>
        <SurfaceList rows={data.faculty.surfaces} search={search} />
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        variant="section"
        title="Student Cora features"
        description="How Cora Assistant classified student work in the last 30 days."
      >
        <FeatureList rows={data.student.byFeature} />
      </InstructorPolicySurfaceCard>

      <InstructorPolicySurfaceCard
        variant="section"
        title="Copilot features"
        description="How Cora Copilot classified your teaching work in the last 30 days."
      >
        <FeatureList rows={data.faculty.byFeature} />
      </InstructorPolicySurfaceCard>

      {data.student.bySource.length > 0 ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Student conversation sources"
          description="Which student module opened Cora Assistant."
        >
          <div className="divide-y divide-[var(--border)]">
            {data.student.bySource
              .filter((row) => !search || row.label.toLowerCase().includes(search))
              .map((row, index) => {
                const stripe = portalListStripe(index, "amber")
                return (
                  <div key={row.source} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                          stripe.iconBg,
                          stripe.iconText,
                        )}
                      >
                        {row.questions}
                      </div>
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", PORTAL_TEXT)}>{row.label}</p>
                        <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>{row.students} students</p>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}

      {data.faculty.byCapability.length > 0 ? (
        <InstructorPolicySurfaceCard
          variant="section"
          title="Copilot threads by capability"
          description="How your saved Cora Copilot conversations are tagged."
        >
          <div className="divide-y divide-[var(--border)]">
            {data.faculty.byCapability.map((row, index) => {
              const stripe = portalListStripe(index, "amber")
              return (
                <div key={row.capability} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums",
                        stripe.iconBg,
                        stripe.iconText,
                      )}
                    >
                      {row.threads}
                    </div>
                    <p className={cn("text-sm font-medium", PORTAL_TEXT)}>
                      {capabilityLookup[row.capability] ?? row.capability}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </InstructorPolicySurfaceCard>
      ) : null}
    </div>
  )
}
