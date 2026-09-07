"use client"

import { Check, Clock, Minus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { PRESENCE_COLORS } from "@/lib/presence/constants"
import type { PresenceStatus } from "@/lib/presence/types"

type PresenceAvatarBadgeProps = {
  status?: PresenceStatus
  className?: string
  size?: "sm" | "md" | "lg"
}

const BADGE_DIM: Record<NonNullable<PresenceAvatarBadgeProps["size"]>, string> = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
}

/** Icon box as a fraction of inner badge area — keeps strokes inside the ring. */
const BADGE_ICON: Record<NonNullable<PresenceAvatarBadgeProps["size"]>, string> = {
  sm: "h-[5px] w-[5px]",
  md: "h-[6px] w-[6px]",
  lg: "h-[7px] w-[7px]",
}

const BADGE_STROKE: Record<NonNullable<PresenceAvatarBadgeProps["size"]>, number> = {
  sm: 2.25,
  md: 2.25,
  lg: 2.5,
}

export function PresenceAvatarBadge({ status, className, size = "md" }: PresenceAvatarBadgeProps) {
  if (!status) return null

  const color = PRESENCE_COLORS[status]
  const dim = BADGE_DIM[size]
  const icon = BADGE_ICON[size]
  const stroke = BADGE_STROKE[size]

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 z-10 pointer-events-none",
        "flex items-center justify-center rounded-full box-border overflow-hidden",
        "border-2 border-white dark:border-[#0B1120]",
        dim,
        status === "offline" && "bg-white dark:bg-[#0B1120]",
        className,
      )}
      style={status !== "offline" ? { backgroundColor: color } : { borderColor: color }}
      aria-hidden
    >
      {status === "available" && (
        <Check className={cn(icon, "text-white shrink-0")} strokeWidth={stroke} aria-hidden />
      )}
      {status === "dnd" && (
        <Minus className={cn(icon, "text-white shrink-0")} strokeWidth={stroke} aria-hidden />
      )}
      {status === "away" && (
        <Clock className={cn(icon, "text-[#5c4a00] shrink-0")} strokeWidth={stroke} aria-hidden />
      )}
      {status === "offline" && (
        <X className={cn(icon, "text-[#919191] shrink-0")} strokeWidth={stroke} aria-hidden />
      )}
    </div>
  )
}
