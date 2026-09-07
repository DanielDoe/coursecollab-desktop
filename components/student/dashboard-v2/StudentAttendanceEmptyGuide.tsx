"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Flame,
  Hash,
  QrCode,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { PORTAL_CARD, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"

const PREVIEW_WEEKS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"]
const PREVIEW_BARS = [72, 88, 65, 91]

type StudentAttendanceEmptyGuideProps = {
  variant: "insights" | "log"
  homeHref?: string
}

export function StudentAttendanceEmptyGuide({
  variant,
  homeHref = "/student/dashboard-v2/attendance",
}: StudentAttendanceEmptyGuideProps) {
  const theme = getStudentModuleTheme("attendance")

  if (variant === "log") {
    return (
      <div className="space-y-4 px-4 py-6 sm:px-5">
        <div className="space-y-2 opacity-40" aria-hidden>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-[68px] items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-3"
            >
              <div className="size-9 shrink-0 rounded-lg bg-[var(--muted)]" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3 w-32 rounded bg-[var(--muted)]" />
                <div className="h-2.5 w-24 rounded bg-[var(--muted)]/70" />
              </div>
              <div className="h-4 w-8 rounded bg-[var(--muted)]" />
            </div>
          ))}
        </div>
        <EmptyGuideFooter homeHref={homeHref} />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-5 sm:px-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewCard
          icon={TrendingUp}
          title="Weekly trend"
          description="See if you're improving week over week."
          theme={theme}
        >
          <ul className="mt-3 space-y-2 opacity-50" aria-hidden>
            {PREVIEW_WEEKS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span className="w-10 text-[10px] text-[var(--cc-text-muted)]">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--muted)]">
                  <div
                    className="h-full rounded-full bg-[var(--cc-accent)]"
                    style={{ width: `${PREVIEW_BARS[i]}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </PreviewCard>

        <PreviewCard
          icon={Flame}
          title="Streak badges"
          description="Hit 3, 5, 10+ day streaks for bragging rights."
          theme={theme}
        >
          <div className="mt-3 flex flex-wrap gap-2 opacity-50" aria-hidden>
            {[3, 5, 10].map((d) => (
              <span
                key={d}
                className="rounded-full border border-dashed border-[var(--border)] px-2.5 py-1 text-[10px] font-medium text-[var(--cc-text-muted)]"
              >
                {d}-day
              </span>
            ))}
          </div>
        </PreviewCard>

        <PreviewCard
          icon={Target}
          title="90% goal path"
          description="Know exactly how many classes you need to stay on track."
          theme={theme}
        >
          <div className="mt-3 opacity-50" aria-hidden>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--muted)]">
              <div className="h-full w-[62%] rounded-full bg-[var(--cc-accent)]" />
            </div>
            <p className={cn("mt-1.5 text-[10px]", PORTAL_TEXT_MUTED)}>
              Example: 2 more present days → 90%
            </p>
          </div>
        </PreviewCard>

        <PreviewCard
          icon={BarChart3}
          title="Class breakdown"
          description="Spot which course is pulling your rate down."
          theme={theme}
        >
          <div className="mt-3 space-y-1.5 opacity-50" aria-hidden>
            {["Lecture A", "Lab B"].map((title, i) => (
              <div
                key={title}
                className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30 px-2 py-1.5 text-[10px]"
              >
                <span className="truncate text-[var(--cc-text-muted)]">{title}</span>
                <span className="font-medium tabular-nums text-[var(--cc-text)]">
                  {i === 0 ? "4/5" : "2/3"}
                </span>
              </div>
            ))}
          </div>
        </PreviewCard>
      </div>

      <GettingStartedSteps homeHref={homeHref} />
    </div>
  )
}

function PreviewCard({
  icon: Icon,
  title,
  description,
  theme,
  children,
}: {
  icon: typeof TrendingUp
  title: string
  description: string
  theme: ReturnType<typeof getStudentModuleTheme>
  children: ReactNode
}) {
  return (
    <div className={cn(PORTAL_CARD, "border-dashed px-3.5 py-3 sm:px-4")}>
      <div className="flex items-start gap-2.5">
        <div className={cn("rounded-lg p-1.5", theme.page.iconBg, theme.page.iconText)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--cc-text)]">{title}</p>
          <p className={cn("mt-0.5 text-[11px] leading-snug", PORTAL_TEXT_MUTED)}>{description}</p>
          {children}
        </div>
      </div>
    </div>
  )
}

function GettingStartedSteps({ homeHref }: { homeHref: string }) {
  const steps = [
    {
      icon: QrCode,
      title: "Check in during class",
      detail: "Scan the QR code or enter the fallback code from Home.",
    },
    {
      icon: Hash,
      title: "Build your first streak",
      detail: "Back-to-back present days unlock streak milestones.",
    },
    {
      icon: Trophy,
      title: "Climb the section board",
      detail: "Points and attendance % rank you against classmates.",
    },
  ]

  return (
    <div className={cn(PORTAL_CARD, "overflow-hidden")}>
      <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-[var(--cc-text)]">Getting started</p>
        <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
          One check-in unlocks trends, goals, and your session log.
        </p>
      </div>
      <ol className="divide-y divide-[var(--border)]">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <li key={step.title} className="flex gap-3 px-4 py-3 sm:px-5">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  "bg-[var(--cc-accent-soft)] text-[var(--cc-accent-dark)]",
                )}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--cc-text)]">
                  <Icon className="h-3.5 w-3.5 text-[var(--cc-text-muted)]" />
                  {step.title}
                </p>
                <p className={cn("mt-0.5 text-xs leading-relaxed", PORTAL_TEXT_MUTED)}>
                  {step.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <EmptyGuideFooter homeHref={homeHref} className="border-t border-[var(--border)]" />
    </div>
  )
}

function EmptyGuideFooter({
  homeHref,
  className,
}: {
  homeHref: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-4 py-4 sm:flex-row sm:justify-between sm:px-5", className)}>
      <p className={cn("text-center text-xs sm:text-left", PORTAL_TEXT_MUTED)}>
        Your instructor opens attendance when class starts.
      </p>
      <Button
        asChild
        size="sm"
        className="h-9 shrink-0 rounded-xl border-0 shadow-none hover:opacity-90"
        style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
      >
        <Link href={`${homeHref}#student-check-in-sessions`}>
          Go to check-in
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )
}
