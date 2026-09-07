"use client"

import { useState, useEffect } from "react"
import { motion } from "@/components/student/dashboard-v2/light-motion"
import {
  ChartColumn,
  Flame,
  Zap,
  Trophy,
  Target,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getStudentModuleTheme } from "@/lib/student-module-themes"
import { cachedFetchJson } from "@/lib/student-client-cache"
import { getStudentAuthHeaders, resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"
import { resolveStudentGradeDisplay } from "@/lib/student-grade-display"
import {
  formatDashboardKpiValue,
  formatKpiPercent,
  roundKpiNumber,
} from "@/lib/dashboard-v2/format-kpi-value"
import { CardWrapper } from "./CardWrapper"
import { useAppearance } from "@/components/appearance/AppearanceProvider"

interface KPIData {
  currentGrade: number
  streakDays: number
  aiCredits: number
  xpPoints: number
  topicMastery: number
  leaderboardRank: number
  gradeTrend: number
  streakTrend: number
}

const CARD_CONFIG = [
  { key: "currentGrade" as const, label: "Current Grade", icon: ChartColumn, moduleId: "grades" },
  { key: "streakDays" as const, label: "Streak Days", icon: Flame, moduleId: "attendance" },
  { key: "aiCredits" as const, label: "AI Credits", icon: Zap, moduleId: "ai-tutor" },
  { key: "xpPoints" as const, label: "XP Points", icon: GraduationCap, moduleId: "practice" },
  { key: "topicMastery" as const, label: "Topic Mastery %", icon: Target, moduleId: "quizzes" },
  { key: "leaderboardRank" as const, label: "Leaderboard Rank", icon: Trophy, moduleId: "classroom-points" },
]

function getValue(data: KPIData, key: keyof KPIData, label: string): string | number {
  const val = data[key]
  if (key === "leaderboardRank") return val === 0 ? "—" : `#${val}`
  return formatDashboardKpiValue(val as number, "auto", label)
}

function getTrend(key: string, data: KPIData): { value: number; positive: boolean } | null {
  if (key === "currentGrade" && data.gradeTrend !== 0) return { value: data.gradeTrend, positive: data.gradeTrend > 0 }
  if (key === "streakDays" && data.streakTrend !== 0) return { value: data.streakTrend, positive: data.streakTrend > 0 }
  return null
}

/** Dashboard KPI cards — semantic color per metric when enabled */
export function KPICards() {
  const { semanticColorsEnabled } = useAppearance()
  const brandPage = getStudentModuleTheme("dashboard").page
  const [data, setData] = useState<KPIData>({
    currentGrade: 0,
    streakDays: 0,
    aiCredits: 50,
    xpPoints: 245,
    topicMastery: 0,
    leaderboardRank: 0,
    gradeTrend: 0,
    streakTrend: 0,
  })

  useEffect(() => {
    const studentId = resolveStudentDatabaseId()
    if (!studentId) return
    const fetchData = async () => {
      try {
        const [gradePayload, profilePayload] = await Promise.all([
          cachedFetchJson(
            `grades:${studentId}`,
            async () => {
              const res = await studentApiFetch(`/api/grades/student?studentId=${studentId}`, {
                headers: getStudentAuthHeaders(),
              })
              if (!res.ok) throw new Error("grades")
              return res.json()
            },
            180_000,
          ),
          cachedFetchJson(
            `profile:${studentId}`,
            async () => {
              const res = await studentApiFetch(`/api/student/profile?studentId=${studentId}`)
              if (!res.ok) throw new Error("profile")
              return res.json() as Promise<{
                profile?: { achievements?: { streak_days?: number } }
                student?: { achievements?: { streak_days?: number } }
              }>
            },
            300_000,
          ),
        ])
        const display = resolveStudentGradeDisplay(gradePayload)
        setData((prev) => ({
          ...prev,
          currentGrade: roundKpiNumber(display.totalScore),
          gradeTrend: 2.5,
        }))
        const p = profilePayload.profile || profilePayload.student
        setData((prev) => ({ ...prev, streakDays: p?.achievements?.streak_days ?? 0 }))
      } catch (e) {
        console.error("[KPICards] Failed to fetch:", e)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {CARD_CONFIG.map((config, i) => {
        const Icon = config.icon
        const value = getValue(data, config.key, config.label)
        const trend = getTrend(config.key, data)
        const pageTheme = semanticColorsEnabled
          ? getStudentModuleTheme(config.moduleId).page
          : brandPage

        return (
          <CardWrapper key={config.key} delay={i * 0.05}>
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex size-12 items-center justify-center rounded-2xl p-3 animate-float",
                    pageTheme.iconBg,
                    pageTheme.iconText,
                  )}
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </div>
                {trend && (
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium uppercase tracking-wider",
                      trend.positive ? "text-[var(--cc-sem-success-text)]" : "text-[var(--cc-sem-danger-text)]"
                    )}
                  >
                    {trend.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                    {roundKpiNumber(Math.abs(trend.value)).toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="mt-4 text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[var(--cc-text)]">{value}</p>
              <p className="mt-1 text-xs sm:text-sm text-[var(--cc-text-muted)] uppercase tracking-wider">{config.label}</p>
            </div>
          </CardWrapper>
        )
      })}
    </div>
  )
}
