"use client"

import { useState } from "react"
import { ShieldCheck, X } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "sa-notice-dismissed"

export function ScheduleAdjustmentNoticeBanner({
  audience = "faculty",
}: {
  audience?: "faculty" | "student"
}) {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return sessionStorage.getItem(STORAGE_KEY) !== "1"
    } catch {
      return true
    }
  })

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  const title = audience === "student" ? "Pick the times you can attend" : "Approval required before finalize"
  const body =
    audience === "student"
      ? "Tap a day name to select the whole column, or drag down a column to mark several slots at once."
      : "Department and university requirements must be met before a class time is changed."

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-2xl border px-3 py-3 sm:px-4",
        "border-[var(--cc-accent-border)] bg-[var(--cc-accent-soft)] text-[var(--cc-text)]",
      )}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--cc-accent)] text-white">
        <ShieldCheck className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--cc-text-muted)] sm:text-sm">{body}</p>
      </div>
      <button
        type="button"
        className="rounded-lg p-1.5 text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft-strong)] hover:text-[var(--cc-text)]"
        onClick={dismiss}
        aria-label="Dismiss notice"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
