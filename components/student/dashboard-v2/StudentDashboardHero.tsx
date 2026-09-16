"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BookOpen, ClipboardList, Lightbulb, Settings2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CORA_NAV_LABEL } from "@/lib/cora/constants"
import { getStudentData } from "@/lib/auth"
import { COURSE_SWITCH_EVENT } from "@/lib/data/types"
import { cn } from "@/lib/utils"

function firstName(fullName: string | undefined): string {
  const part = fullName?.trim().split(/\s+/)[0]
  return part || "there"
}

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
  {
    href: "/student/dashboard-v2/ai-tutor",
    label: CORA_NAV_LABEL,
    icon: Sparkles,
  },
  {
    href: "/student/dashboard-v2/practice",
    label: "Practice",
    icon: Lightbulb,
  },
  {
    href: "/student/dashboard-v2/quizzes",
    label: "Quizzes",
    icon: ClipboardList,
  },
  {
    href: "/student/dashboard-v2/lectures",
    label: "Lectures",
    icon: BookOpen,
  },
] as const

export function StudentDashboardHero({ onCustomize }: { onCustomize: () => void }) {
  const [now, setNow] = useState(() => new Date())
  const [studentTick, setStudentTick] = useState(0)
  const student = useMemo(() => {
    void studentTick
    return getStudentData()
  }, [studentTick])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const onSwitch = () => setStudentTick((value) => value + 1)
    window.addEventListener(COURSE_SWITCH_EVENT, onSwitch)
    window.addEventListener("student-session-ready", onSwitch)
    return () => {
      window.removeEventListener(COURSE_SWITCH_EVENT, onSwitch)
      window.removeEventListener("student-session-ready", onSwitch)
    }
  }, [])

  const name = firstName(student?.name)
  const courseLabel = [student?.courseCode, student?.section, student?.courseTitle]
    .filter(Boolean)
    .join(" · ")
  const school = student?.universityShortName || student?.universityName

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {courseLabel ? (
              <span className="text-[11px] font-medium text-[var(--cc-text-secondary)]">{courseLabel}</span>
            ) : null}
            {school ? (
              <span className="text-[11px] font-medium text-[var(--cc-text-muted)]">· {school}</span>
            ) : null}
            <span className="text-[11px] font-medium text-[var(--cc-text-muted)]">· {formatToday(now)}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--cc-text)] sm:text-2xl">
            {greetingPrefix(now.getHours())}, {name}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-10 shrink-0 rounded-full border-[var(--border)] bg-[var(--background)]/80"
            onClick={onCustomize}
            title="Customize dashboard"
          >
            <Settings2 className="h-4 w-4" strokeWidth={2} aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  )
}
