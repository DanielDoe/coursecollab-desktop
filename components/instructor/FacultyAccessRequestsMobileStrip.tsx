"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, ChevronRight } from "lucide-react"
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers"
import { appendNativeAppQuery } from "@/lib/mobile-native-app"
import { useNativeApp } from "@/hooks/use-native-app"
import { cn } from "@/lib/utils"

const DISMISS_AFTER_MS = 8000
const DISMISS_STORAGE_KEY = "faculty-access-requests-banner-dismissed"

function readDismissedAtCount(): number {
  if (typeof sessionStorage === "undefined") return 0
  const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY)
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Mobile/web faculty strip — surfaces pending access requests with count badge. */
export function FacultyAccessRequestsMobileStrip({ className }: { className?: string }) {
  const isNative = useNativeApp()
  const [pending, setPending] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await instructorApiFetch("/api/instructor/access-requests/summary", {
          headers: buildInstructorApiHeaders(),
        })
        if (!res.ok) return
        const data = (await res.json()) as { pending?: number }
        if (!cancelled) setPending(Number(data.pending ?? 0))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (pending <= 0) return
    if (readDismissedAtCount() >= pending) {
      setVisible(false)
      return
    }
    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      try {
        sessionStorage.setItem(DISMISS_STORAGE_KEY, String(pending))
      } catch {
        /* ignore */
      }
    }, DISMISS_AFTER_MS)
    return () => window.clearTimeout(timer)
  }, [pending])

  if (pending <= 0 || !visible) return null

  const href = appendNativeAppQuery("/instructor/dashboard-v2/management/students?tab=account-requests")

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
        isNative && "mx-3 mb-2",
        className,
      )}
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200/80 dark:bg-amber-500/30">
        <Shield className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-600 px-1 text-[10px] font-bold text-white">
          {pending > 99 ? "99+" : pending}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Access requests</p>
        <p className="text-xs opacity-80">
          {pending} pending — review student and Career Member requests
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
    </Link>
  )
}
