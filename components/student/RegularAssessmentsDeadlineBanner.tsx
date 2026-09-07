"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  isPastRegularAssessmentsHardClose,
  REGULAR_ASSESSMENTS_DEADLINE_LABEL,
} from "@/lib/regular-assessments-cutoff"

/** Bump suffix when message changes so students see the banner again. */
const DISMISS_STORAGE_KEY = "cc_dismiss_banner_regular_assess_deadline_20260616_v1"

type Props = {
  /** Announcements page for this dashboard (v1 vs v2). */
  announcementsHref?: string
  className?: string
}

export function RegularAssessmentsDeadlineBanner({
  announcementsHref = "/student/dashboard-v2/announcements",
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (isPastRegularAssessmentsHardClose()) return
    try {
      if (localStorage.getItem(DISMISS_STORAGE_KEY) === "1") return
    } catch {
      /* private mode */
    }
    setVisible(true)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Course deadline notice"
      className={`relative overflow-hidden rounded-xl border border-amber-200/90 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 shadow-sm ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-8 w-8 shrink-0 rounded-lg text-amber-900/60 hover:bg-amber-100/80 hover:text-amber-950 dark:text-amber-200/70 dark:hover:bg-amber-900/40"
        onClick={dismiss}
        aria-label="Dismiss deadline reminder"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex flex-col gap-3 p-4 pr-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              Deadline: quizzes, homework &amp; mid-semesters
            </p>
            <p className="text-sm text-amber-900/85 dark:text-amber-200/80 leading-snug">
              Finish all attempts by{" "}
              <span className="font-medium whitespace-nowrap">{REGULAR_ASSESSMENTS_DEADLINE_LABEL}</span>
              . After that, those assessments close for grading—including retakes and rollover on that work.
              Final exams follow your instructor&apos;s separate schedule.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
        >
          <Link href={announcementsHref}>View announcement</Link>
        </Button>
      </div>
    </div>
  )
}
