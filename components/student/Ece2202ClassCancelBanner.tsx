"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ECE2202_CLASS_CANCEL_BANNER_DISMISS_KEY,
  ECE2202_CLASS_CANCEL_CLASS_DATE_LABEL,
  isEce2202ClassCancelAnnouncementActive,
  isEce2202StudentSection,
} from "@/lib/ece2202-class-cancel-june23-announcement"

type Props = {
  announcementsHref?: string
  className?: string
}

export function Ece2202ClassCancelBanner({
  announcementsHref = "/student/dashboard-v2/announcements",
  className = "",
}: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!isEce2202ClassCancelAnnouncementActive()) return

    const section =
      sessionStorage.getItem("studentSection") ||
      localStorage.getItem("studentSection") ||
      ""
    if (!isEce2202StudentSection(section)) return

    try {
      if (localStorage.getItem(ECE2202_CLASS_CANCEL_BANNER_DISMISS_KEY) === "1") return
    } catch {
      /* private mode */
    }
    setVisible(true)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(ECE2202_CLASS_CANCEL_BANNER_DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="region"
      aria-label="Class cancellation notice"
      className={`relative overflow-hidden rounded-xl border border-rose-200/90 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/40 shadow-sm ${className}`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 h-8 w-8 shrink-0 rounded-lg text-rose-900/60 hover:bg-rose-100/80 hover:text-rose-950 dark:text-rose-200/70 dark:hover:bg-rose-900/40"
        onClick={dismiss}
        aria-label="Dismiss class cancellation notice"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex flex-col gap-3 p-4 pr-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-rose-950 dark:text-rose-100">
              No class {ECE2202_CLASS_CANCEL_CLASS_DATE_LABEL}
            </p>
            <p className="text-sm text-rose-900/85 dark:text-rose-200/80 leading-snug">
              I have an emergency and cannot meet tomorrow. Please start <strong>Op-Amps Lecture 4</strong>,
              complete the sample practice problems on the slides, and watch the recorded lecture. Classroom
              Points op-amp questions and RC/RL material will be uploaded tomorrow. Sorry for the inconvenience.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="shrink-0 bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          <Link href={announcementsHref}>View announcement</Link>
        </Button>
      </div>
    </div>
  )
}
