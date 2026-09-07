"use client"

import { ChevronRight, MessageSquare, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CoraLogo } from "@/components/cora/CoraLogo"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import {
  facultyCoraCapabilityThumb,
  type FacultyCoraCapability,
} from "@/lib/cora/faculty-capabilities"
import type { FacultyCoraInsight } from "@/lib/cora/faculty-cora-client"
import type { CoraChrome } from "@/lib/cora/cora-chrome-theme"
import {
  FACULTY_CORA_GREETING,
  FACULTY_CORA_NAV_LABEL,
  FACULTY_CORA_TAGLINE,
} from "@/lib/cora/constants"
import { cn } from "@/lib/utils"

type Props = {
  instructorName?: string
  courseCode?: string | null
  courseLabel?: string | null
  capabilities: FacultyCoraCapability[]
  insights: FacultyCoraInsight[]
  chrome: CoraChrome
  onOpenCapability: (capability: FacultyCoraCapability) => void
  onStartCapability: (capability: FacultyCoraCapability, prompt?: string) => void
  onOpenInsights: () => void
  onOpenWorkspace: () => void
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function FacultyCoraHomePanel({
  instructorName,
  courseCode,
  courseLabel,
  capabilities,
  insights,
  chrome,
  onOpenCapability,
  onStartCapability,
  onOpenInsights,
  onOpenWorkspace,
}: Props) {
  const displayName = instructorName?.trim().split(/\s+/)[0] || "there"
  const greeting = greetingForHour(new Date().getHours())
  const weekInsight = insights.find((insight) => insight.title?.trim() || insight.body?.trim())
  const courseLine = courseCode || courseLabel || "Your course"

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0">
          <CoraLogo size="sm" />
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
            {greeting}, {displayName}
          </h1>
          <div
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: chrome.soft, color: chrome.ink }}
          >
            <Sparkles className="h-3 w-3" />
            {FACULTY_CORA_TAGLINE}
          </div>
          <p className="mt-2 text-sm text-[var(--cc-text-muted)]">
            {courseLine} · {FACULTY_CORA_GREETING}
          </p>
        </div>
        <Button
          type="button"
          className="h-10 w-full shrink-0 rounded-xl border-0 px-4 sm:w-auto"
          style={{ backgroundColor: chrome.roles.cta.fill, color: chrome.roles.cta.icon }}
          onClick={onOpenWorkspace}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Open chat
        </Button>
      </div>

      {weekInsight ? (
        <section className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            This week
          </p>
          <button
            type="button"
            onClick={() => {
              const capability = capabilities.find((item) => item.id === weekInsight.capabilityId)
              if (capability) onStartCapability(capability, `${weekInsight.title}. ${weekInsight.body}`)
              else onOpenInsights()
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3.5 text-left transition hover:border-[var(--cc-accent)]/40"
          >
            <SolidListThumbTile thumb={chrome.roles.capability[0] ?? chrome.roles.cta} icon={Sparkles} size="compact" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--cc-text)]">{weekInsight.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-[var(--cc-text-muted)]">{weekInsight.body}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--cc-text-muted)]" />
          </button>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
          Capabilities
        </p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {capabilities.map((capability) => {
            const thumb = facultyCoraCapabilityThumb(capability.id, chrome)
            const Icon = capability.icon
            return (
              <button
                key={capability.id}
                type="button"
                onClick={() => onOpenCapability(capability)}
                className={cn(
                  "group flex min-h-[6.25rem] items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-left transition",
                  "hover:-translate-y-0.5 hover:border-[var(--cc-accent)]/35",
                )}
              >
                <SolidListThumbTile thumb={thumb} icon={Icon} size="compact" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--cc-text)]">{capability.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">{capability.tagline}</p>
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[var(--cc-text-muted)] transition group-hover:text-[var(--cc-text)]" />
              </button>
            )
          })}
        </div>
      </section>

      <p className="px-1 text-xs leading-relaxed text-[var(--cc-text-muted)]">
        Cora drafts and recommends teaching changes. Apply edits in the module. Billing and admin stay with you.
      </p>
    </div>
  )
}
