"use client"

import { useMemo, useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Medal, Award, Crown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import {
  PortalLeaderboardPodium,
  buildPortalPodiumEntries,
} from "@/components/dashboard-v2/PortalLeaderboardPodium"
import { CodebenchLeaderboardSkeleton } from "@/components/codebench/CodebenchSkeletons"

interface LeaderboardTabProps {
  embedInDashboard?: boolean
}

interface LeaderboardEntry {
  rank: number
  student_id?: number | string
  student_code: string
  student_name: string
  section: string
  xp: number
  total_activities: number
  last_activity: string
}

function isYou(entry: LeaderboardEntry, currentId: string | null) {
  if (!currentId) return false
  return (
    String(entry.student_id ?? "") === currentId ||
    String(entry.student_code ?? "") === currentId
  )
}

export function LeaderboardTab({ embedInDashboard }: LeaderboardTabProps = {}) {
  const { roles } = useCodebenchChrome()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const currentStudentId =
    typeof window !== "undefined" ? sessionStorage.getItem("studentDatabaseId") : null

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const studentId = sessionStorage.getItem("studentDatabaseId")
        if (!studentId) {
          setEntries([])
          return
        }

        const response = await fetch(`/api/codebench/leaderboard?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          setEntries((data.leaderboard || []) as LeaderboardEntry[])
        } else {
          const errorData = await response.json()
          if (errorData.error?.includes("403")) {
            toast({
              title: "Access Required",
              description: "Trailblazer membership or beta access required for global leaderboard",
              variant: "destructive",
            })
          }
          setEntries([])
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error)
        toast({
          title: "Error",
          description: "Failed to load leaderboard",
          variant: "destructive",
        })
        setEntries([])
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [toast])

  const podiumEntries = useMemo(
    () =>
      buildPortalPodiumEntries(
        entries.slice(0, 3).map((e) => ({ ...e, score: e.xp })),
        (row, rank) => ({
          rank,
          primaryLabel: row.student_name || "Student",
          secondaryLabel: row.section ? `Section ${row.section}` : undefined,
          score: row.xp,
          scoreUnit: "XP",
          scoreDetail: `${row.total_activities} activities`,
        }),
      ),
    [entries],
  )

  const listEntries = entries

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-400" />
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (rank === 3) return <Award className="h-6 w-6 text-orange-400" />
    return <span className="text-lg font-bold text-slate-400">#{rank}</span>
  }

  if (loading) {
    return <CodebenchLeaderboardSkeleton />
  }

  if (embedInDashboard) {
    return (
      <div className="space-y-5">
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

        {entries.length === 0 ? (
          <div className={cn("py-12 text-center", EMBED_MATERIAL_PANEL)}>
            <div className="mx-auto mb-4 flex justify-center">
              <SolidListThumbTile thumb={roles.leaderboard} icon={Trophy} />
            </div>
            <div className={cn("mb-2 text-lg font-semibold", PORTAL_TEXT)}>No entries yet</div>
            <div className={cn("text-sm", PORTAL_TEXT_MUTED)}>
              Start coding and submitting to see your rank!
            </div>
          </div>
        ) : (
          <>
            {podiumEntries.length > 0 ? (
              <PortalLeaderboardPodium entries={podiumEntries} heading="Podium" />
            ) : null}

            <div className={cn("overflow-hidden", EMBED_MATERIAL_PANEL)}>
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>Student rankings</h3>
                <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                  {entries.length} student{entries.length === 1 ? "" : "s"}
                </span>
              </div>

              {listEntries.length === 0 ? (
                <p className={cn("px-4 py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
                  More students will appear here as they earn XP.
                </p>
              ) : (
                <ul className="max-h-[min(520px,55vh)] space-y-1 overflow-y-auto p-2 sm:p-3">
                  {listEntries.map((entry) => {
                    const you = isYou(entry, currentStudentId)
                    const rankThumb =
                      entry.rank === 1
                        ? { fill: "#EAB308", icon: "#1C1917" }
                        : entry.rank === 2
                          ? { fill: "#94A3B8", icon: "#0F172A" }
                          : entry.rank === 3
                            ? { fill: "#D97706", icon: "#FFF7ED" }
                            : you
                              ? roles.cta
                              : codebenchChromeKpi(entry.rank, roles)

                    return (
                      <li
                        key={`${entry.student_id ?? entry.student_code}-${entry.rank}`}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors sm:px-4",
                          "bg-[var(--muted)]/25 hover:bg-[var(--muted)]/40",
                          you && "bg-[var(--cc-accent-soft)] ring-1 ring-[var(--cc-accent)]/25",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{ backgroundColor: rankThumb.fill, color: rankThumb.icon }}
                          >
                            {entry.rank === 1 ? <Crown className="h-4 w-4" /> : entry.rank}
                          </div>
                          <div className="min-w-0">
                            <div className={cn("truncate font-semibold", PORTAL_TEXT)}>
                              {entry.student_name}
                              {you ? (
                                <span
                                  className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                  style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
                                >
                                  You
                                </span>
                              ) : null}
                            </div>
                            <div className={cn("mt-0.5 truncate text-xs", PORTAL_TEXT_MUTED)}>
                              {entry.section ? `${entry.section} · ` : ""}
                              {entry.total_activities} activities
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className={cn("text-lg font-bold tabular-nums sm:text-xl", PORTAL_TEXT)}>
                            {entry.xp.toLocaleString()}
                          </div>
                          <div className={cn("text-[10px] uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                            XP
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <Card className="border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 shadow-xl backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="rounded-lg bg-blue-500/10 p-2 dark:bg-blue-500/20">
            <Trophy className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
            Global Leaderboard
          </span>
        </CardTitle>
        <p className="mt-1 text-sm text-slate-400">
          Top performers based on CodeBench submissions and practice problems
        </p>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <Trophy className="mx-auto mb-4 h-16 w-16 opacity-50" />
            <div className="mb-2 text-lg font-semibold">No entries yet</div>
            <div className="text-sm">Start coding and submitting to see your rank!</div>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const you = isYou(entry, currentStudentId)
              return (
                <div
                  key={entry.rank}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-4 transition-all",
                    you
                      ? "border-blue-500/50 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 shadow-lg"
                      : entry.rank <= 3
                        ? "border-slate-600/50 bg-slate-700/50"
                        : "border-slate-600/30 bg-slate-700/30",
                  )}
                >
                  <div className="flex items-center gap-4">
                    {getRankIcon(entry.rank)}
                    <div>
                      <div className="flex items-center gap-2 font-bold text-slate-200">
                        {entry.student_name}
                        {you ? (
                          <span className="rounded-full bg-blue-500/30 px-2 py-0.5 text-xs text-blue-300">
                            You
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {entry.section} • {entry.total_activities} activities
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-yellow-400">{entry.xp.toLocaleString()}</div>
                    <div className="text-xs text-slate-400">XP</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
