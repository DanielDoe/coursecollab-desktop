"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Zap } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { XPTracker } from "./XPTracker"
import { getCurrentXP } from "@/lib/codebench-xp"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { cn } from "@/lib/utils"

interface MoreMenuProps {
  code: string
  studentId: string | null
  embedded?: boolean
  compact?: boolean
  theme?: "light" | "dark"
}

export function MoreMenu({ embedded, compact, theme = "dark" }: MoreMenuProps) {
  const router = useRouter()
  const [xp, setXp] = useState(0)
  const isLight = theme === "light"
  const { soft, accent } = useCodebenchChrome()

  useEffect(() => {
    if (typeof window === "undefined") return
    setXp(getCurrentXP())
    const handleXPUpdate = (e: CustomEvent) => setXp(e.detail.xp)
    window.addEventListener("codebench-xp-updated", handleXPUpdate as EventListener)
    return () => window.removeEventListener("codebench-xp-updated", handleXPUpdate as EventListener)
  }, [])

  const handleNavigate = () => {
    const base = embedded ? "/student/dashboard-v2/codebench" : "/student/codebench"
    router.push(`${base}/more`)
  }

  const level = Math.floor(xp / 100) + 1

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-codebench-xp-trigger
          aria-label={`More options, ${xp} XP, level ${level}`}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border font-bold transition-all active:scale-[0.97]",
            compact ? "h-7 min-w-[48px] gap-0.5 px-1.5 shadow-none" : "gap-1.5 px-3 py-2 text-sm",
          )}
          style={{
            borderColor: `${accent}80`,
            backgroundColor: soft,
            color: accent,
          }}
        >
          <Zap className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
          <span
            className={cn(
              "tabular-nums",
              compact ? "text-[11px] font-extrabold" : "text-sm font-bold",
            )}
          >
            {xp.toLocaleString()}
          </span>
          {!compact ? (
            <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">XP</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-codebench-xp-menu
        className={cn(
          "z-[80] w-64 shadow-xl",
          isLight
            ? "border-slate-200 bg-white text-slate-900 shadow-slate-200/60"
            : "bg-[#131825] text-slate-100 shadow-black/40",
        )}
        style={isLight ? undefined : { borderColor: `${accent}4D` }}
        align="end"
        sideOffset={6}
      >
        <div className={cn("border-b p-3", isLight ? "border-slate-200" : "border-white/10")}>
          <XPTracker xp={xp} variant="dropdown" theme={theme} />
        </div>
        <DropdownMenuItem
          onClick={handleNavigate}
          className={cn(
            "cursor-pointer gap-2 font-medium",
            isLight ? "!text-slate-900" : "!text-slate-100",
          )}
        >
          <BarChart3 className="h-4 w-4 shrink-0" style={{ color: accent }} />
          <span className={cn(isLight ? "!text-slate-900" : "!text-slate-100")}>
            Analytics & progress
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
