"use client"

import { useState } from "react"
import {
  ArrowRight,
  Calendar,
  Flame,
  Sparkles,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CardWrapper } from "@/components/student/dashboard-v2/CardWrapper"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
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

type Props = {
  studentName?: string
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

export function CoraHomePanel({
  studentName,
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

  return (
    <div className="space-y-6">
      <div
        className={cn(
          EMBED_MATERIAL_PANEL,
          "relative overflow-hidden p-6 sm:p-8",
        )}
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${chrome.soft} 42%, var(--card)), color-mix(in srgb, ${chrome.mid} 22%, var(--card)) 55%, var(--card))`,
        }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium text-[var(--cc-text-muted)]">
            {greeting}, {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--cc-text)] sm:text-3xl">
            What would you like to accomplish today?
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--cc-text-secondary)]">
            {CORA_NAME} orchestrates your learning — not just answers, but guided problem-solving across your entire course.
          </p>
          {creditsLabel ? (
            <p className="mt-3 text-xs font-medium text-[var(--cc-text-muted)]">{creditsLabel}</p>
          ) : null}
        </div>
        <Sparkles
          className="pointer-events-none absolute -right-4 -top-4 h-32 w-32 opacity-20"
          style={{ color: chrome.accent }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {capabilities.map((action, i) => (
          <CoraCapabilityCard
            key={action.id}
            capability={action}
            thumb={coraChromeCapabilityThumb(action.id, chrome.roles)}
            index={i}
            onClick={() => setSheetCapability(action)}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CardWrapper variant="inner" delay={0.05} hover={false} className="lg:col-span-2">
          <div className="p-5">
            <h3 className="flex items-center gap-2 font-semibold text-[var(--cc-text)]">
              <Sparkles className="h-4 w-4" style={{ color: chrome.accent }} />
              Today&apos;s recommendations
            </h3>
            {recommendations.length ? (
              <div className="mt-4 space-y-3">
                {recommendations.slice(0, 6).map((rec) => (
                  <div
                    key={rec.id}
                    className={cn(
                      EMBED_MATERIAL_PANEL,
                      "flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
                    )}
                  >
                    <div>
                      <p className="font-medium text-[var(--cc-text)]">{rec.title}</p>
                      <p className="text-xs text-[var(--cc-text-muted)]">{rec.description}</p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-xl border-0"
                      type="button"
                      onClick={() => handleRecClick(rec)}
                      style={{
                        backgroundColor: chrome.roles.cta.fill,
                        color: chrome.roles.cta.icon,
                      }}
                    >
                      Continue
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--cc-text-muted)]">
                Start with <span className="font-medium text-[var(--cc-text)]">Solve</span> or open a lecture in{" "}
                <span className="font-medium text-[var(--cc-text)]">Learn</span> — {CORA_NAME} will personalize
                recommendations as you go.
              </p>
            )}
          </div>
        </CardWrapper>

        <CardWrapper variant="inner" delay={0.08} hover={false}>
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" style={{ color: chrome.roles.panel.fill }} />
              <h3 className="font-semibold text-[var(--cc-text)]">Stay consistent</h3>
            </div>
            <p className="text-sm text-[var(--cc-text-muted)]">{CORA_MOTTO}</p>
            <div className="flex items-center gap-3 text-xs text-[var(--cc-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" style={{ color: chrome.roles.hero.fill }} /> Daily focus
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" style={{ color: chrome.accent }} /> Plan ahead
              </span>
            </div>
          </div>
        </CardWrapper>
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
