"use client"

import { useState } from "react"
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Flame,
  Layers,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react"
import { CoraCapabilityCard } from "@/components/cora/platform/CoraCapabilityCard"
import { StudentCoraCapabilitySheet } from "@/components/cora/platform/StudentCoraCapabilitySheet"
import {
  coraChromeCapabilityThumb,
  type CoraChrome,
} from "@/lib/cora/cora-chrome-theme"
import type { CoraPlatformTab } from "@/lib/cora/platform-nav"
import { CORA_MOTTO, CORA_NAME } from "@/lib/cora/constants"
import type { StudentCoraCapability } from "@/lib/cora/student-capabilities"
import {
  resolveCoraTodayLink,
  type CoraTodayRecommendation,
} from "@/lib/cora/today-recommendations"
import { cn } from "@/lib/utils"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"

type Props = {
  studentName?: string
  courseLabel?: string | null
  recommendations: CoraTodayRecommendation[]
  capabilities: StudentCoraCapability[]
  chrome: CoraChrome
  creditsLabel?: string | null
  onNavigate: (tab: CoraPlatformTab, toolId?: string) => void
  onStartCapability: (capability: StudentCoraCapability, prompt?: string) => void
  onResumeCapability?: (capability: StudentCoraCapability) => void
  canResumeCapability?: (capabilityId: string) => boolean
  onRecommendationNavigate?: (rec: CoraTodayRecommendation) => void
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function recommendationIcon(link: string | undefined) {
  const href = link ?? ""
  if (href.includes("practice") || href.includes("flashcards")) return Layers
  if (href.includes("lecture") || href.includes("summarize")) return BookOpen
  if (href.includes("study-plan") || href.includes("prepare-exam")) return Calendar
  if (href.includes("quiz") || href.includes("homework")) return Target
  return Sparkles
}

export function CoraHomePanel({
  studentName,
  courseLabel,
  recommendations,
  capabilities,
  chrome,
  creditsLabel = null,
  onNavigate,
  onStartCapability,
  onResumeCapability,
  canResumeCapability,
  onRecommendationNavigate,
}: Props) {
  const firstName = studentName?.split(" ")[0] ?? "there"
  const greeting = greetingForHour(new Date().getHours())
  const [sheetCapability, setSheetCapability] = useState<StudentCoraCapability | null>(null)
  const sheetThumb = sheetCapability
    ? coraChromeCapabilityThumb(sheetCapability.id, chrome.roles)
    : chrome.roles.cta

  const handleRecClick = (rec: CoraTodayRecommendation) => {
    if (onRecommendationNavigate) {
      onRecommendationNavigate(rec)
      return
    }
    const resolved = resolveCoraTodayLink(rec.link)
    if (resolved.kind === "tab") onNavigate(resolved.tab, resolved.toolId)
    else window.location.href = resolved.href
  }

  const visibleRecommendations = recommendations.slice(0, 5)

  return (
    <div className="@container/cora-home min-w-0 space-y-5 overflow-x-hidden sm:space-y-6">
      <div
        className={cn(
          EMBED_MATERIAL_PANEL,
          "relative overflow-hidden p-5 sm:p-6",
        )}
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${chrome.soft} 38%, var(--card)), color-mix(in srgb, ${chrome.mid} 18%, var(--card)) 55%, var(--card))`,
        }}
      >
        <div className="relative z-10 min-w-0">
          <p className="text-sm font-medium text-[var(--cc-text-muted)]">
            {greeting}, {firstName}
          </p>
          <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[var(--cc-text)] sm:text-2xl">
            What would you like to accomplish today?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--cc-text-secondary)]">
            {CORA_NAME} orchestrates your learning — guided problem-solving across your course.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {courseLabel ? (
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 font-medium"
                style={{
                  backgroundColor: `${chrome.soft}55`,
                  color: chrome.accent,
                }}
              >
                {courseLabel}
              </span>
            ) : null}
            {creditsLabel ? (
              <span className="text-[var(--cc-text-muted)]">{creditsLabel}</span>
            ) : null}
          </div>
        </div>
        <Sparkles
          className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 opacity-15 sm:h-28 sm:w-28"
          style={{ color: chrome.accent }}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 @min-[420px]/cora-home:grid-cols-2 @min-[840px]/cora-home:grid-cols-4">
        {(capabilities ?? []).map((action, i) => (
          <CoraCapabilityCard
            key={action.id}
            capability={action}
            thumb={coraChromeCapabilityThumb(action.id, chrome.roles)}
            index={i}
            onClick={() => setSheetCapability(action)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 @min-[720px]/cora-home:grid-cols-3 @min-[720px]/cora-home:gap-5">
        <section className={cn("min-w-0 @min-[720px]/cora-home:col-span-2", EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--cc-text)]">
                <Sparkles className="h-4 w-4 shrink-0" style={{ color: chrome.accent }} />
                Today&apos;s recommendations
              </h2>
              <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">
                {courseLabel
                  ? `Personalized for ${courseLabel}`
                  : "Based on your course activity and deadlines"}
              </p>
            </div>
            {visibleRecommendations.length > 0 ? (
              <span className="shrink-0 rounded-full bg-[var(--muted)]/60 px-2.5 py-1 text-[11px] font-medium text-[var(--cc-text-secondary)]">
                {visibleRecommendations.length} suggestion
                {visibleRecommendations.length === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>

          {visibleRecommendations.length ? (
            <ul className="space-y-2">
              {visibleRecommendations.map((rec) => {
                const Icon = recommendationIcon(rec.link)
                return (
                  <li key={rec.id}>
                    <button
                      type="button"
                      onClick={() => handleRecClick(rec)}
                      className={cn(
                        "group flex w-full min-w-0 items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                        "border-[color-mix(in_srgb,var(--cc-text)_10%,transparent)]",
                        "hover:border-[color-mix(in_srgb,var(--cc-accent)_25%,transparent)] hover:bg-[var(--muted)]/25",
                      )}
                    >
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: `${chrome.soft}66`,
                          color: chrome.accent,
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--cc-text)]">
                          {rec.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-[var(--cc-text-muted)] line-clamp-2">
                          {rec.description}
                        </span>
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--cc-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="rounded-xl bg-[var(--muted)]/25 px-4 py-6 text-center">
              <Sparkles
                className="mx-auto mb-2 h-8 w-8 opacity-40"
                style={{ color: chrome.accent }}
              />
              <p className="text-sm text-[var(--cc-text-muted)]">
                Start with <span className="font-medium text-[var(--cc-text)]">Solve</span> or open a
                lecture in <span className="font-medium text-[var(--cc-text)]">Learn</span> — {CORA_NAME}{" "}
                will personalize recommendations as you go.
              </p>
            </div>
          )}
        </section>

        <aside className={cn("min-w-0 @min-[720px]/cora-home:col-span-1", EMBED_MATERIAL_PANEL, "p-4 sm:p-5")}>
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 shrink-0" style={{ color: chrome.roles.panel.fill }} />
            <h2 className="text-sm font-semibold text-[var(--cc-text)]">Stay consistent</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--cc-text-muted)]">{CORA_MOTTO}</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--cc-text-secondary)]">
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-3.5 w-3.5" style={{ color: chrome.roles.hero.fill }} />
              Daily focus
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" style={{ color: chrome.accent }} />
              Plan ahead
            </span>
          </div>
        </aside>
      </div>

      <StudentCoraCapabilitySheet
        open={Boolean(sheetCapability)}
        capability={sheetCapability}
        thumb={sheetThumb}
        cta={chrome.roles.cta}
        onClose={() => setSheetCapability(null)}
        canResume={sheetCapability ? Boolean(canResumeCapability?.(sheetCapability.id)) : false}
        onStart={(capability, prompt) => {
          setSheetCapability(null)
          onStartCapability(capability, prompt)
        }}
        onResume={
          onResumeCapability
            ? (capability) => {
                setSheetCapability(null)
                onResumeCapability(capability)
              }
            : undefined
        }
      />
    </div>
  )
}
