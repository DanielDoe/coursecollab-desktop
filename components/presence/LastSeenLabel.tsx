"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { formatLastSeenLabel } from "@/lib/presence/last-seen"
import type { ManualPresenceStatus, PresenceStatus } from "@/lib/presence/types"

type LastSeenLabelProps = {
  status?: PresenceStatus
  lastSeenAt?: string | null
  manualStatus?: ManualPresenceStatus | null
  className?: string
  /** Refresh relative time (default 60s). */
  refreshMs?: number
}

export function LastSeenLabel({
  status,
  lastSeenAt,
  manualStatus,
  className,
  refreshMs = 60_000,
}: LastSeenLabelProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), refreshMs)
    return () => window.clearInterval(id)
  }, [refreshMs])

  const label = formatLastSeenLabel(status, lastSeenAt, manualStatus, now)
  if (!label) return null

  return (
    <span className={cn("text-slate-500 dark:text-slate-400", className)} title={label}>
      {label}
    </span>
  )
}

type RoleWithLastSeenProps = {
  role: string
  status?: PresenceStatus
  lastSeenAt?: string | null
  manualStatus?: ManualPresenceStatus | null
  className?: string
}

/** Role label with optional middle dot + last seen (e.g. "Faculty · Last seen 5 minutes ago"). */
export function RoleWithLastSeen({
  role,
  status,
  lastSeenAt,
  manualStatus,
  className,
}: RoleWithLastSeenProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const lastSeen = formatLastSeenLabel(status, lastSeenAt, manualStatus, now)

  return (
    <p
      className={cn(
        "text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-w-0",
        className,
      )}
    >
      <span className="whitespace-nowrap">{role}</span>
      {lastSeen ? (
        <>
          <span className="text-slate-300 dark:text-slate-600 whitespace-nowrap" aria-hidden>
            {" · "}
          </span>
          <span className="whitespace-nowrap">{lastSeen}</span>
        </>
      ) : null}
    </p>
  )
}
