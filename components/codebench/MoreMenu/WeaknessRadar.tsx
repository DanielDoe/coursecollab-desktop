"use client"

import { cn } from "@/lib/utils"

interface WeaknessRadarProps {
  concepts: any
  embedInDashboard?: boolean
}

export function WeaknessRadar({ concepts, embedInDashboard }: WeaknessRadarProps) {
  const weaknesses = concepts?.weaknesses || []

  if (weaknesses.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <div
          className={cn(
            "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full",
            embedInDashboard
              ? "bg-[var(--cc-success)]/10"
              : "bg-gradient-to-br from-green-500/20 to-emerald-500/20",
          )}
        >
          <div className="text-4xl">🎉</div>
        </div>
        <div
          className={cn(
            "mb-2 text-xl font-semibold",
            embedInDashboard ? "text-[var(--cc-success)]" : "text-green-400",
          )}
        >
          No major weaknesses detected!
        </div>
        <div className={embedInDashboard ? "text-[var(--cc-text-muted)]" : "text-slate-400"}>
          Keep up the great work!
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {weaknesses.map((weakness: string, idx: number) => (
        <div
          key={idx}
          className={cn(
            "flex items-center gap-4 rounded-xl border p-4 transition-colors",
            embedInDashboard
              ? "border-[var(--cc-warning)]/25 bg-[var(--cc-warning)]/5 hover:bg-[var(--cc-warning)]/10"
              : "border-red-500/30 bg-gradient-to-r from-red-500/10 to-orange-500/10 shadow-lg hover:border-red-500/50",
          )}
        >
          <div
            className={cn(
              "h-3 w-3 shrink-0 rounded-full",
              embedInDashboard ? "bg-[var(--cc-warning)]" : "bg-red-400 shadow-lg shadow-red-400/50",
            )}
          />
          <div className="flex-1">
            <div
              className={cn(
                "mb-1 text-base font-semibold",
                embedInDashboard ? "text-[var(--foreground)]" : "text-red-300",
              )}
            >
              {weakness}
            </div>
            <div className={embedInDashboard ? "text-xs text-[var(--cc-text-muted)]" : "text-xs text-slate-400"}>
              Focus on practicing this concept
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
