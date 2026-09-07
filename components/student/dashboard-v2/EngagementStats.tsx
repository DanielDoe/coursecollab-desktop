"use client"

import { useState, useEffect } from "react"
import { Flame, Award, Sparkles, ChevronRight } from "lucide-react"
import { CardWrapper } from "./CardWrapper"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { resolveStudentDatabaseId, resolveStudentSection } from "@/lib/auth"
import {
  fetchCachedClassroomPoints,
  fetchCachedGrades,
  fetchCachedStreaks,
} from "@/lib/dashboard-v2/student-stats-client"
import {
  clampGradebookEngagementCredits,
  ENGAGEMENT_POINTS,
} from "@/lib/engagement-points-system"
import { KPI_ACCENT } from "@/lib/appearance/dashboard-kpi-accents"
import { formatKpiCount, formatKpiDecimal, roundKpiNumber } from "@/lib/dashboard-v2/format-kpi-value"

interface EngagementData {
  streak: number
  classroomPoints: number
  engagementCredits: number
}

export function EngagementStats() {
  const [data, setData] = useState<EngagementData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const studentId = resolveStudentDatabaseId()
    const section = resolveStudentSection()
    if (!studentId) {
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const [pointsPayload, gradesPayload, streaksPayload] = await Promise.all([
          fetchCachedClassroomPoints(studentId, section),
          fetchCachedGrades(studentId, section),
          fetchCachedStreaks(studentId).catch(() => null),
        ])

        let streak = 0
        let classroomPoints = 0
        let engagementCredits = 0

        if (pointsPayload && typeof pointsPayload === "object") {
          const { summary } = pointsPayload as { summary?: { total_points?: number } }
          classroomPoints = roundKpiNumber(Number(summary?.total_points ?? 0))
        }

        if (gradesPayload && typeof gradesPayload === "object") {
          const { grade } = gradesPayload as { grade?: { engagement_credits?: number } }
          engagementCredits = clampGradebookEngagementCredits(grade?.engagement_credits)
        }

        if (streaksPayload && typeof streaksPayload === "object") {
          const json = streaksPayload as { streak?: { currentStreak?: number } }
          streak = Number(json?.streak?.currentStreak ?? 0)
        }

        setData({ streak, classroomPoints, engagementCredits })
      } catch (e) {
        console.error("[EngagementStats] Failed:", e)
        setData({ streak: 0, classroomPoints: 0, engagementCredits: 0 })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <CardWrapper delay={0.3}>
        <div className="p-6 h-[140px] animate-pulse bg-slate-200/30 dark:bg-white/5 rounded-2xl" />
      </CardWrapper>
    )
  }

  const creditMax = ENGAGEMENT_POINTS.gradebookTotalMax
  const credits = data?.engagementCredits ?? 0
  const creditPct = Math.min(100, Math.round((credits / creditMax) * 100))

  const items = [
    {
      label: "Attendance streak",
      detail: "Consecutive classes attended",
      value: formatKpiCount(data?.streak ?? 0),
      unit: "days",
      icon: Flame,
      accent: KPI_ACCENT.orange,
      href: "/student/dashboard-v2/attendance",
    },
    {
      label: "Classroom points",
      detail: "Earned in class this term",
      value: formatKpiDecimal(data?.classroomPoints ?? 0),
      unit: "pts",
      icon: Award,
      accent: KPI_ACCENT.lime,
      href: "/student/dashboard-v2/classroom-points",
    },
    {
      label: "Engagement credits",
      detail: `${credits} of ${creditMax} toward the gradebook`,
      value: formatKpiCount(credits),
      unit: `/ ${creditMax}`,
      icon: Sparkles,
      accent: KPI_ACCENT.violet,
      href: "/student/dashboard-v2/trade-center",
      progress: creditPct,
    },
  ]

  return (
    <CardWrapper delay={0.3}>
      <div className="flex h-full min-h-[280px] flex-col p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            Academic Engagement
          </h3>
          <Link
            href="/student/dashboard-v2/classroom-points"
            className="flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--cc-accent-dark)] hover:underline"
          >
            View all <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.label}
                href={item.href}
                className="group flex flex-1 items-center gap-3.5 rounded-2xl bg-[var(--muted)]/35 px-3.5 py-3 transition-colors hover:bg-[var(--cc-accent-soft)]"
              >
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    item.accent.iconWell,
                  )}
                >
                  <Icon className={cn("h-5 w-5", item.accent.icon)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--cc-text)]">{item.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--cc-text-muted)]">{item.detail}</p>
                  {"progress" in item && item.progress != null ? (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
                      <div
                        className="h-full rounded-full bg-[var(--cc-accent)]"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-semibold tabular-nums leading-none text-[var(--cc-text)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--cc-text-muted)]">{item.unit}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-[var(--cc-text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            )
          })}
        </div>
      </div>
    </CardWrapper>
  )
}
