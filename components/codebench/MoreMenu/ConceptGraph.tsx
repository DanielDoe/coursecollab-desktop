"use client"

import { cn } from "@/lib/utils"

interface ConceptGraphProps {
  concepts: any
  embedInDashboard?: boolean
}

export function ConceptGraph({ concepts, embedInDashboard }: ConceptGraphProps) {
  const conceptData = concepts?.concepts || {
    loops: 0,
    pointers: 0,
    oop: 0,
    recursion: 0,
    arrays: 0,
    stl: 0,
  }

  const conceptsList = [
    { name: "Loops", value: conceptData.loops || 0, color: "bg-blue-500" },
    { name: "Pointers", value: conceptData.pointers || 0, color: "bg-purple-500" },
    { name: "OOP", value: conceptData.oop || 0, color: "bg-pink-500" },
    { name: "Recursion", value: conceptData.recursion || 0, color: "bg-green-500" },
    { name: "Arrays", value: conceptData.arrays || 0, color: "bg-yellow-500" },
    { name: "STL", value: conceptData.stl || 0, color: "bg-orange-500" },
  ]

  const maxValue = Math.max(...conceptsList.map((c) => c.value), 100)

  return (
    <div className="space-y-4">
      {conceptsList.map((concept) => (
        <div key={concept.name} className="space-y-2">
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "font-medium",
                embedInDashboard ? "text-[var(--foreground)]" : "text-slate-200",
              )}
            >
              {concept.name}
            </span>
            <span
              className={cn(
                "text-lg font-bold",
                embedInDashboard ? "text-[var(--cc-accent-dark)]" : "text-slate-300",
              )}
            >
              {concept.value}%
            </span>
          </div>
          <div
            className={cn(
              "h-4 w-full overflow-hidden rounded-full shadow-inner",
              embedInDashboard ? "bg-[var(--muted)]" : "bg-slate-700/50",
            )}
          >
            <div
              className={cn(
                "relative h-full rounded-full transition-all duration-700",
                embedInDashboard ? "bg-[var(--cc-accent)] shadow-none" : `${concept.color} shadow-lg`,
              )}
              style={{ width: `${(concept.value / maxValue) * 100}%` }}
            >
              {!embedInDashboard ? (
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

