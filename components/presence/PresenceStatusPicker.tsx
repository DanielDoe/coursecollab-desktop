"use client"

import { ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { PresenceIndicator } from "@/components/presence/PresenceAvatar"
import { PresenceStatusMenu } from "@/components/presence/PresenceStatusMenu"
import { useSelfPresence } from "@/components/presence/PresenceSelfProvider"

type PresenceStatusPickerProps = {
  className?: string
}

export function PresenceStatusPicker({ className }: PresenceStatusPickerProps) {
  const { status, statusLabel } = useSelfPresence()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-600 dark:text-slate-400",
            "hover:bg-slate-100 dark:hover:bg-white/10 transition-colors",
            className,
          )}
        >
          <PresenceIndicator status={status} size="sm" variant="inline" />
          <span>{statusLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-56 p-2",
          "bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100",
          "border-slate-200 dark:border-white/10 shadow-xl",
        )}
      >
        <PresenceStatusMenu variant="compact" />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
