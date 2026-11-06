"use client"

import { useEffect, useState } from "react"
import type { ProjectScoreBreakdown } from "@/lib/projects/project-scoring-engine"
import { cn } from "@/lib/utils"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"

export function ProjectScoreBreakdownPanel({
  projectId,
  compact,
}: {
  projectId: number
  compact?: boolean
}) {
  const [breakdown, setBreakdown] = useState<ProjectScoreBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/projects/score-breakdown?projectId=${projectId}`, {
          headers: getInstructorScopeHeaders(),
        })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        if (!cancelled) setBreakdown(data.breakdown)
      } catch {
        if (!cancelled) setBreakdown(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Loading grade breakdown…</p>
  }
  if (!breakdown) return null

  return (
    <div className={cn("space-y-2", compact ? "text-xs" : "text-sm")}>
      <p className={cn("font-medium", PORTAL_TEXT)}>How was this grade calculated?</p>
      {breakdown.lines.map((line) => (
        <div key={line.key} className="rounded-lg border border-[var(--border)] px-3 py-2">
          <div className="flex justify-between gap-2">
            <span className={PORTAL_TEXT}>{line.label}</span>
            <span className={cn("tabular-nums font-medium", PORTAL_TEXT)}>
              {line.points_earned.toFixed(1)} / {line.points_possible.toFixed(1)}
            </span>
          </div>
          <p className={cn("text-xs tabular-nums", PORTAL_TEXT_MUTED)}>
            Raw {line.raw_percent.toFixed(1)}% · Weight {line.weight_percent}% · Contrib {line.contribution_points.toFixed(1)} pts
          </p>
          <p className={cn("mt-1", PORTAL_TEXT_MUTED)}>{line.explanation}</p>
        </div>
      ))}
      <p className={cn("font-semibold tabular-nums", PORTAL_TEXT)}>
        Total: {breakdown.total_earned.toFixed(1)} / {breakdown.max_points.toFixed(1)} (
        {breakdown.percent.toFixed(1)}%)
      </p>
      {breakdown.legacy ? (
        <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Legacy peer + instructor scoring (unchanged).</p>
      ) : null}
    </div>
  )
}
