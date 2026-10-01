"use client"

import { useEffect, useMemo, useState } from "react"
import { Crown, Trophy } from "lucide-react"
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"
import { CodebenchLeaderboardSkeleton } from "@/components/codebench/CodebenchSkeletons"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { instructorApiFetch, readInstructorApiJson } from "@/lib/instructor-api-headers"
import { useInstructorScopeKey } from "@/hooks/use-instructor-scope-key"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

type LeaderboardRow = {
  rank: number
  student_id: number
  student_name: string
  section: string | null
  xp: number
  total_activities: number
}

export function InstructorCodebenchLeaderboardPanel() {
  const { roles } = useCodebenchChrome()
  const scopeKey = useInstructorScopeKey()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await instructorApiFetch("/api/instructor/codebench/leaderboard")
        const parsed = await readInstructorApiJson<{ leaderboard?: LeaderboardRow[] }>(res, "CodeBench leaderboard")
        if (cancelled) return
        if (!parsed.ok) {
          setRows([])
          setError(parsed.error)
          return
        }
        setRows(parsed.data.leaderboard ?? [])
      } catch {
        if (!cancelled) {
          setRows([])
          setError("Could not load the CodeBench leaderboard.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [scopeKey])

  const podiumEntries = useMemo(
    () =>
      buildPortalPodiumEntries(rows.slice(0, 3), (row, rank) => ({
        rank,
        primaryLabel: row.student_name || "Student",
        secondaryLabel: row.section ? `Section ${row.section}` : undefined,
        score: row.xp,
        scoreUnit: "XP",
        scoreDetail: `${row.total_activities} activities`,
      })),
    [rows],
  )

  if (loading) {
    return <CodebenchLeaderboardSkeleton />
  }

  return (
    <div className="w-full shrink-0 space-y-5 pb-2">
      <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
        <div className="flex items-center gap-2.5">
          <SolidListThumbTile thumb={roles.leaderboard} icon={Trophy} size="compact" />
          <div>
            <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Global Leaderboard</h2>
            <p className={cn("mt-0.5 text-sm", PORTAL_TEXT_MUTED)}>
              Top performers based on CodeBench submissions and practice problems
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className={cn("px-4 py-8 text-sm", EMBED_MATERIAL_PANEL, PORTAL_TEXT_MUTED)}>{error}</div>
      ) : rows.length === 0 ? (
        <div className={cn("py-12 text-center", EMBED_MATERIAL_PANEL)}>
          <div className="mx-auto mb-4 flex justify-center">
            <SolidListThumbTile thumb={roles.leaderboard} icon={Trophy} />
          </div>
          <div className={cn("mb-2 text-lg font-semibold", PORTAL_TEXT)}>No entries yet</div>
          <div className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Students appear here after they earn CodeBench XP.
          </div>
        </div>
      ) : (
        <>
          {podiumEntries.length > 0 ? (
            <PortalLeaderboardPodium entries={podiumEntries} heading="Podium" className="shrink-0" />
          ) : null}

          <div className={cn("overflow-hidden", EMBED_MATERIAL_PANEL)}>
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Student rankings</h3>
              <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                {rows.length} student{rows.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="max-h-[min(520px,55vh)] space-y-1 overflow-y-auto p-2 sm:p-3">
              {rows.map((row) => {
                const rankThumb =
                  row.rank === 1
                    ? { fill: "#EAB308", icon: "#1C1917" }
                    : row.rank === 2
                      ? { fill: "#94A3B8", icon: "#0F172A" }
                      : row.rank === 3
                        ? { fill: "#D97706", icon: "#FFF7ED" }
                        : codebenchChromeKpi(row.rank, roles)

                return (
                  <li
                    key={row.student_id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[var(--muted)]/25 px-3 py-3 hover:bg-[var(--muted)]/40 sm:px-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ backgroundColor: rankThumb.fill, color: rankThumb.icon }}
                      >
                        {row.rank === 1 ? <Crown className="h-4 w-4" /> : row.rank}
                      </div>
                      <div className="min-w-0">
                        <div className={cn("truncate font-semibold", PORTAL_TEXT)}>{row.student_name}</div>
                        <div className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>
                          {row.section ? `${row.section} · ` : ""}
                          {row.total_activities} activities
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={cn("text-lg font-bold tabular-nums sm:text-xl", PORTAL_TEXT)}>
                        {row.xp.toLocaleString()}
                      </div>
                      <div className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>XP</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
