"use client"

import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { MANUAL_PRESENCE_OPTIONS } from "@/lib/presence/constants"
import { PresenceIndicator } from "@/components/presence/PresenceAvatar"
import { useSelfPresence } from "@/components/presence/PresenceSelfProvider"
import type { ManualPresenceStatus } from "@/lib/presence/types"

type PresenceStatusMenuProps = {
  variant?: "compact" | "profile"
  className?: string
  onSelect?: () => void
}

export function PresenceStatusMenu({ variant = "profile", className, onSelect }: PresenceStatusMenuProps) {
  const { manualStatus, setStatus, resetStatus } = useSelfPresence()

  async function pick(next: ManualPresenceStatus) {
    await setStatus(next)
    onSelect?.()
  }

  async function handleReset() {
    await resetStatus()
    onSelect?.()
  }

  if (variant === "compact" || variant === "profile") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        {MANUAL_PRESENCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => void pick(option.value)}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg text-sm",
              "text-slate-900 dark:text-slate-100",
              "hover:bg-slate-100 dark:hover:bg-white/10 transition-colors",
              manualStatus === option.value && "bg-slate-100 dark:bg-white/10",
            )}
          >
            <PresenceIndicator status={option.mapsTo} size="md" variant="inline" />
            <span className="font-medium">{option.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => void handleReset()}
          className={cn(
            "flex items-center gap-2.5 w-full px-3 py-2 text-left rounded-lg text-sm transition-colors mt-1 border-t pt-2",
            "text-slate-700 dark:text-slate-200",
            "border-slate-200 dark:border-white/10",
            "hover:bg-slate-100 dark:hover:bg-white/10",
          )}
        >
          <RotateCcw className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          <span>Reset status</span>
        </button>
      </div>
    )
  }

  return null
}

type PresenceStatusTriggerProps = {
  className?: string
  showLabel?: boolean
}

export function PresenceStatusTrigger({ className, showLabel = true }: PresenceStatusTriggerProps) {
  const { status, statusLabel } = useSelfPresence()
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs leading-none text-slate-600 dark:text-slate-400",
        className,
      )}
    >
      <PresenceIndicator status={status} size="sm" variant="inline" />
      {showLabel && <span className="leading-none">{statusLabel}</span>}
    </span>
  )
}
