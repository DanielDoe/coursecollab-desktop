"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { PresenceAvatarBadge } from "@/components/presence/PresenceAvatarBadge"
import { PresenceStatusMenu, PresenceStatusTrigger } from "@/components/presence/PresenceStatusMenu"
import { useSelfPresence } from "@/components/presence/PresenceSelfProvider"

export function ProfileAvatarWithPresence({ children, className }: { children: ReactNode; className?: string }) {
  const { status } = useSelfPresence()
  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      {children}
      <PresenceAvatarBadge status={status} size="md" />
    </div>
  )
}

export function ProfileRoleWithStatus({
  role,
  className,
}: {
  role: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5 mt-1 min-w-0", className)}>
      <span className="text-xs leading-none text-slate-500 dark:text-slate-400 shrink-0">{role}</span>
      <span className="text-slate-300 dark:text-slate-600 leading-none shrink-0" aria-hidden>
        ·
      </span>
      <PresenceStatusTrigger className="min-w-0" />
    </div>
  )
}

export function ProfileDropdownPresenceBlock({
  className,
  onSelect,
}: {
  className?: string
  onSelect?: () => void
}) {
  return (
    <div
      className={cn(
        "px-2 py-2 border-b border-slate-200/80 dark:border-white/[0.08]",
        className,
      )}
    >
      <PresenceStatusMenu variant="compact" onSelect={onSelect} />
    </div>
  )
}
