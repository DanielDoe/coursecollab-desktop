"use client"

import { Check, Clock, Minus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { initialsFromName } from "@/lib/initials-from-name"
import { PresenceAvatarBadge } from "@/components/presence/PresenceAvatarBadge"
import { PRESENCE_COLORS } from "@/lib/presence/constants"
import type { PresenceStatus } from "@/lib/presence/types"

const STATUS_LABELS: Record<PresenceStatus, string> = {
  available: "Available",
  busy: "Busy",
  dnd: "Do not disturb",
  away: "Away",
  offline: "Offline",
}

type PresenceIndicatorProps = {
  status: PresenceStatus
  size?: "sm" | "md"
  /** badge = avatar overlay with cutout ring; inline = next to text in menus/headers */
  variant?: "badge" | "inline"
  className?: string
  showLabel?: boolean
}

export function presenceLabel(status: PresenceStatus): string {
  return STATUS_LABELS[status]
}

export function PresenceIndicator({
  status,
  size = "sm",
  variant = "badge",
  className,
  showLabel,
}: PresenceIndicatorProps) {
  const dim =
    variant === "inline"
      ? size === "sm"
        ? "h-3.5 w-3.5"
        : "h-4 w-4"
      : size === "sm"
        ? "h-3 w-3"
        : "h-3.5 w-3.5"
  const iconClass =
    variant === "inline"
      ? size === "sm"
        ? "h-[7px] w-[7px]"
        : "h-2 w-2"
      : size === "sm"
        ? "h-[5px] w-[5px]"
        : "h-[6px] w-[6px]"
  const stroke =
    variant === "inline" ? (size === "sm" ? 2.25 : 2.5) : size === "sm" ? 2.25 : 2.25
  const color = PRESENCE_COLORS[status]

  return (
    <span className={cn("inline-flex items-center gap-1.5 leading-none", className)}>
      <span
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden",
          dim,
          variant === "badge" && "border-2 border-white dark:border-slate-900",
          variant === "inline" && status === "offline" && "ring-1 ring-[#919191]",
          status === "offline" && variant === "badge" && "bg-white dark:bg-slate-900",
        )}
        style={status !== "offline" ? { backgroundColor: color } : { borderColor: color }}
        title={STATUS_LABELS[status]}
        aria-label={STATUS_LABELS[status]}
      >
        {status === "available" && (
          <Check className={cn(iconClass, "text-white")} strokeWidth={stroke} />
        )}
        {status === "dnd" && <Minus className={cn(iconClass, "text-white")} strokeWidth={stroke} />}
        {status === "away" && (
          <Clock className={cn(iconClass, "text-[#5c4a00]")} strokeWidth={stroke} />
        )}
        {status === "offline" && <X className={cn(iconClass, "text-[#919191]")} strokeWidth={stroke} />}
      </span>
      {showLabel && (
        <span className="text-xs text-slate-600 dark:text-slate-400">{STATUS_LABELS[status]}</span>
      )}
    </span>
  )
}

type PresenceAvatarProps = {
  name: string
  status?: PresenceStatus
  mine?: boolean
  size?: "sm" | "md"
  className?: string
}

function initials(name: string): string {
  return initialsFromName(name)
}

export function PresenceAvatar({ name, status, mine, size = "md", className }: PresenceAvatarProps) {
  const box = size === "sm" ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs"

  return (
    <div className={cn("relative shrink-0 self-start", box, className)}>
      <div
        className={cn(
          "flex h-full w-full items-center justify-center rounded-full font-semibold",
          mine
            ? "bg-[#582c83] text-white"
            : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
        )}
        aria-hidden
      >
        {initials(name)}
      </div>
      {status && <PresenceAvatarBadge status={status} size="sm" />}
    </div>
  )
}
