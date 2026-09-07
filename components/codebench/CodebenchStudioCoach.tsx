"use client"

import { AlertTriangle, Bug, CheckCircle2, ChevronRight, Clock, Sparkles, Target, Wrench } from "lucide-react"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { CODEBENCH_PANEL, CODEBENCH_INSET, CODEBENCH_STAT } from "@/lib/codebench/codebench-surface-classes"
import { Button } from "@/components/ui/button"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { getStudioSnapshot, type StudioSnapshot } from "@/lib/codebench-studio-analytics"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"

type Props = {
  studentId: string | null
  variant?: "card" | "full"
  onOpenEditor?: () => void
  onSeeDetails?: () => void
}

function relativeTime(at?: number) {
  if (!at) return ""
  const delta = Date.now() - at
  const minutes = Math.round(delta / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export function CodebenchStudioCoach({
  studentId,
  variant = "full",
  onOpenEditor,
  onSeeDetails,
}: Props) {
  const { roles, accent } = useCodebenchChrome()
  const [snapshot, setSnapshot] = useState<StudioSnapshot | null>(null)
  const compact = variant === "card"

  useEffect(() => {
    if (!studentId) return
    const refresh = () => setSnapshot(getStudioSnapshot(studentId))
    refresh()
    window.addEventListener("codebench-studio-analytics", refresh)
    return () => window.removeEventListener("codebench-studio-analytics", refresh)
  }, [studentId])

  if (!studentId || !snapshot) return null

  const focus = snapshot.lastError ?? snapshot.topErrors[0]
  const location = focus
    ? [focus.lastFile, focus.lastLine != null ? `line ${focus.lastLine}` : null].filter(Boolean).join(" · ")
    : ""

  return (
    <section className={cn(CODEBENCH_PANEL, compact ? "p-4" : "p-4 sm:p-5")}>
      <div className="mb-3 flex items-start gap-2.5">
        <SolidListThumbTile thumb={roles.tool} icon={Sparkles} size="compact" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
            Cora workshop read
          </p>
          <h3 className="text-base font-semibold text-[var(--cc-text)]">{snapshot.coachTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--cc-text-muted)]">{snapshot.coachBody}</p>
        </div>
      </div>

      <div className={cn("grid gap-2", compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
        <Stat label="Runs" value={snapshot.runs} icon={Target} />
        <Stat label="Clean builds" value={`${snapshot.successRate}%`} icon={Sparkles} />
        <Stat label="Faults" value={snapshot.compileErrors} icon={AlertTriangle} />
        {!compact ? <Stat label="Cora asks" value={snapshot.suggestFixes + Object.values(snapshot.toolsUsed).reduce((a, b) => a + b, 0)} icon={Wrench} /> : null}
      </div>

      {focus ? (
        <div className={cn("mt-3 px-3 py-3", CODEBENCH_INSET)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
              Latest clang note
            </p>
            {focus.lastAt ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--cc-text-muted)]">
                <Clock className="h-3 w-3" />
                {relativeTime(focus.lastAt)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-[var(--cc-text)]">
            {focus.label}
            {focus.count > 1 ? <span className="ml-1.5 font-medium text-[var(--cc-text-muted)]">×{focus.count}</span> : null}
            {focus.share > 0 ? (
              <span className="ml-1.5 text-[11px] font-medium text-[var(--cc-text-muted)]">{focus.share}% of faults</span>
            ) : null}
          </p>
          {location ? <p className="mt-0.5 text-[12px] text-[var(--cc-text-muted)]">{location}</p> : null}
          {focus.lastMessage ? (
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[color-mix(in_srgb,var(--cc-accent)_10%,var(--border))] bg-[color-mix(in_srgb,var(--card)_92%,var(--cc-accent)_8%)] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--cc-text)]">
              {focus.lastMessage}
            </pre>
          ) : null}
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--cc-text)]">{snapshot.nextActionLabel}</p>
          {!compact ? <p className="mt-1 text-[12px] text-[var(--cc-text-muted)]">{focus.why}</p> : null}
          {focus.share > 0 ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--cc-accent)_8%,var(--muted))]">
              <div className="h-full rounded-full bg-[var(--cc-accent)]" style={{ width: `${Math.max(8, focus.share)}%` }} />
            </div>
          ) : null}
        </div>
      ) : null}

      {!compact && focus?.checks.length ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Do this next
          </p>
          <ol className="space-y-1.5">
            {focus.checks.map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-sm text-[var(--cc-text)]">
                <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--cc-accent-soft)_50%,var(--card))] text-[10px] font-semibold text-[var(--cc-text-muted)]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[12px] text-[var(--cc-text-muted)]">Habit: {snapshot.habit}</p>
        </div>
      ) : compact && snapshot.habit ? (
        <p className="mt-2 text-[12px] text-[var(--cc-text-muted)]">{snapshot.habit}</p>
      ) : null}

      {!compact && snapshot.topErrors.length > 1 ? (
        <ul className="mt-3 space-y-1.5">
          {snapshot.topErrors.slice(0, 4).map((item) => (
            <li
              key={item.family}
              className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--cc-accent)_10%,var(--border))] bg-[color-mix(in_srgb,var(--card)_90%,var(--cc-accent)_10%)] px-2.5 py-2"
            >
              <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-[var(--cc-text)]">
                  {item.label}
                  <span className="ml-1.5 font-medium text-[var(--cc-text-muted)]">
                    ×{item.count} · {item.share}%
                  </span>
                </p>
                <p className="text-[11px] text-[var(--cc-text-muted)]">{item.nextMove}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!compact && snapshot.topTools.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Cora tools you reach for
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {snapshot.topTools.map((item) => (
              <li
                key={item.tool}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--cc-text)]"
              >
                {item.label}
                <span className="ml-1 text-[var(--cc-text-muted)]">×{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact && snapshot.workshopLog.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--cc-text-muted)]">
            Recent workshop
          </p>
          <ul className="space-y-2">
            {snapshot.workshopLog.slice(0, 6).map((item, index) => (
              <li key={`${item.at}-${index}`} className="flex items-start gap-2">
                {item.tone === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-success)]" />
                ) : item.tone === "error" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-danger)]" />
                ) : (
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--cc-text-muted)]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--cc-text)]">{item.title}</p>
                    <span className="text-[11px] text-[var(--cc-text-muted)]">{relativeTime(item.at)}</span>
                  </div>
                  <p className="truncate font-mono text-[11px] text-[var(--cc-text-muted)]">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onOpenEditor || onSeeDetails ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {onOpenEditor ? (
            <Button
              className="h-9 rounded-xl border-0 px-3 text-[13px] shadow-sm hover:opacity-90"
              style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
              onClick={onOpenEditor}
            >
              Open editor and fix this
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : null}
          {onSeeDetails ? (
            <Button
              variant="ghost"
              className="h-9 rounded-xl px-3 text-[13px] text-[var(--cc-text)] hover:bg-[color-mix(in_srgb,var(--cc-accent-soft)_35%,var(--muted))]"
              onClick={onSeeDetails}
            >
              Workshop details
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function Stat({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Target }) {
  return (
    <div className={CODEBENCH_STAT}>
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="mt-0.5 text-lg font-semibold text-[var(--cc-text)]">{value}</p>
    </div>
  )
}
