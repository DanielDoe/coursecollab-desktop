"use client"

import { useState, useEffect } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import { Trophy, Medal } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { getStudentAuthHeaders, resolveStudentDatabaseId, resolveStudentSection, studentApiFetch } from "@/lib/auth"
import { classroomPointsLeaderboardForCurrentOffering } from "@/lib/classroom-points-leaderboard-scope"
import { PRIVACY_PLACEHOLDER_NAME } from "@/lib/student-privacy"
import { CardWrapper } from "./CardWrapper"

interface LeaderboardEntry {
  rank: number
  name: string
  points: number
  isCurrentUser?: boolean
}

/** Premium Leaderboard */
export function LeaderboardWidget() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [blurPeerNames, setBlurPeerNames] = useState(true)

  useEffect(() => {
    const studentId = resolveStudentDatabaseId()
    const section = resolveStudentSection()
    if (!studentId) return

    const fetchData = async () => {
      try {
        const params = new URLSearchParams({ studentId, limit: "10" })
        if (section) params.set("session", section)
        const res = await studentApiFetch(`/api/classroom-points/leaderboard?${params}`, {
          headers: getStudentAuthHeaders(),
        }).catch(() => null)
        if (res?.ok) {
          const data = await res.json()
          const shouldBlur =
            data.leaderboardPrivacy?.blurPeerNames ?? data.privacyMode ?? true
          setBlurPeerNames(shouldBlur)
          const awarded = classroomPointsLeaderboardForCurrentOffering(
            data.leaderboard || data.entries || [],
            { section },
          )
          const list = awarded.slice(0, 5).map(
            (
              e: {
                rank?: number
                full_name?: string
                name?: string
                student_id?: string
                id?: string
                total_points?: number
                points?: number
                is_current_user?: boolean
              },
              i: number
            ) => {
              const isCurrentUser = Boolean(
                e.is_current_user ||
                  String(e.student_id) === studentId ||
                  String(e.id) === studentId
              )
              const points = e.total_points ?? e.points ?? 0
              return {
                rank: e.rank ?? i + 1,
                name: shouldBlur && !isCurrentUser
                  ? PRIVACY_PLACEHOLDER_NAME
                  : e.full_name || e.name || (isCurrentUser ? "You" : PRIVACY_PLACEHOLDER_NAME),
                points: shouldBlur && !isCurrentUser ? 0 : points,
                isCurrentUser,
              }
            }
          )
          setEntries(list)
        } else {
          setEntries([])
        }
      } catch {
        setEntries([])
      }
    }

    fetchData()
  }, [])

  const displayEntries = entries

  const classroomPointsTheme = getStudentModuleTheme("classroom-points").page

  return (
    <CardWrapper delay={0.35}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">Leaderboard</h3>
          <Link
            href="/student/dashboard-v2/classroom-points"
            className={`text-sm ${classroomPointsTheme.iconText} hover:underline transition-colors uppercase tracking-wider`}
          >
            View full
          </Link>
        </div>

        {displayEntries.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-6">
            No leaderboard data yet
          </p>
        ) : (
          <div className="space-y-2">
            {displayEntries.map((entry, i) => (
              <motion.div
                key={entry.rank}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.05 }}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3 transition-all duration-300",
                  entry.isCurrentUser
                    ? `${classroomPointsTheme.softBg} border ${classroomPointsTheme.border}`
                    : "bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/[0.06]"
                )}
              >
                <div className={`flex size-8 items-center justify-center rounded-xl ${classroomPointsTheme.iconBg}`}>
                  {entry.rank <= 3 ? (
                    <Medal className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  ) : (
                    <span className="text-xs font-semibold text-slate-500 dark:text-white/60">#{entry.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {entry.name}
                    {entry.isCurrentUser && (
                      <span className={`ml-1 text-xs ${classroomPointsTheme.iconText}`}>(You)</span>
                    )}
                  </p>
                </div>
                {entry.isCurrentUser || !blurPeerNames ? (
                  <span className="text-sm font-semibold text-slate-600 dark:text-white/70">{entry.points} pts</span>
                ) : (
                  <span className="text-sm font-semibold text-slate-400 blur-[6px] select-none">•••</span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </CardWrapper>
  )
}
