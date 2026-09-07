"use client"

import { useMemo, useState, useEffect } from "react"
import { Flame, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { codebenchChromeKpi } from "@/lib/codebench-chrome-theme"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { CodebenchStreakSkeleton } from "@/components/codebench/CodebenchSkeletons"

interface StreakTabProps {
  embedInDashboard?: boolean
}

type DayCell = {
  date: Date
  key: string
  active: boolean
  /** 0 idle · 1 light · 2 medium · 3 strong */
  level: 0 | 1 | 2 | 3
  isToday: boolean
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Frontend-only preview heat when the API has no activity yet. */
function buildDemoCalendar(): { calendar: Record<string, number>; streakDays: number; stats: { totalSubmissions: number; activeDays: number } } {
  const calendar: Record<string, number> = {}
  const today = new Date()
  let activeDays = 0
  let total = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split("T")[0]!
    // Pseudo pattern: weekdays more active, weekends quieter
    const dow = d.getDay()
    if (i === 0) {
      calendar[key] = 2
    } else if (dow === 0 || dow === 6) {
      calendar[key] = i % 5 === 0 ? 1 : 0
    } else if (i % 3 === 0) {
      calendar[key] = 3
    } else if (i % 2 === 0) {
      calendar[key] = 2
    } else {
      calendar[key] = i % 4 === 0 ? 0 : 1
    }
    if (calendar[key]! > 0) {
      activeDays++
      total += calendar[key]!
    }
  }
  return {
    calendar,
    streakDays: 3,
    stats: { totalSubmissions: total, activeDays },
  }
}

function toLevel(value: boolean | number | undefined): 0 | 1 | 2 | 3 {
  if (value == null || value === false || value === 0) return 0
  if (value === true) return 2
  const n = Number(value)
  if (n >= 3) return 3
  if (n === 2) return 2
  if (n === 1) return 1
  return 0
}

export function StreakTab({ embedInDashboard }: StreakTabProps = {}) {
  const { roles, soft, mid, accent, deep } = useCodebenchChrome()
  const [streakDays, setStreakDays] = useState(0)
  const [calendarData, setCalendarData] = useState<Record<string, boolean | number>>({})
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)
  const [activityStats, setActivityStats] = useState({ totalSubmissions: 0, activeDays: 0 })
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchStreak = async () => {
      setLoading(true)
      try {
        const studentId = sessionStorage.getItem("studentDatabaseId")
        if (!studentId) {
          const demo = buildDemoCalendar()
          setCalendarData(demo.calendar)
          setStreakDays(demo.streakDays)
          setActivityStats(demo.stats)
          setUsingDemo(true)
          return
        }

        const response = await fetch(`/api/codebench/streak?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          const cal = (data.calendarData || {}) as Record<string, boolean | number>
          const hasActivity = Object.values(cal).some((v) => toLevel(v) > 0)
          if (!hasActivity) {
            const demo = buildDemoCalendar()
            setCalendarData(demo.calendar)
            setStreakDays(Math.max(data.streakDays || 0, demo.streakDays))
            setActivityStats(demo.stats)
            setUsingDemo(true)
          } else {
            setStreakDays(data.streakDays || 0)
            setCalendarData(cal)
            setActivityStats(data.activityStats || { totalSubmissions: 0, activeDays: 0 })
            setUsingDemo(false)
          }

          if (typeof window !== "undefined") {
            localStorage.setItem("codebench_streak_days", String(data.streakDays || 0))
            localStorage.setItem("codebench_streak_calendar", JSON.stringify(cal))
          }
        } else {
          const demo = buildDemoCalendar()
          setCalendarData(demo.calendar)
          setStreakDays(demo.streakDays)
          setActivityStats(demo.stats)
          setUsingDemo(true)
        }
      } catch (error) {
        console.error("Failed to fetch streak:", error)
        const demo = buildDemoCalendar()
        setCalendarData(demo.calendar)
        setStreakDays(demo.streakDays)
        setActivityStats(demo.stats)
        setUsingDemo(true)
      } finally {
        setLoading(false)
      }
    }

    fetchStreak()
  }, [toast])

  const calendarDays: DayCell[] = useMemo(() => {
    const days: DayCell[] = []
    const today = new Date()
    const todayKey = today.toISOString().split("T")[0]!

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const key = date.toISOString().split("T")[0]!
      const level = toLevel(calendarData[key])
      days.push({
        date,
        key,
        active: level > 0,
        level,
        isToday: key === todayKey,
      })
    }
    return days
  }, [calendarData])

  const selected = calendarDays.find((d) => d.key === selectedKey) ?? calendarDays.find((d) => d.isToday) ?? null

  const heatFill = (level: 0 | 1 | 2 | 3) => {
    if (level === 0) return undefined
    if (level === 1) return soft
    if (level === 2) return mid
    return accent
  }

  const heatInk = (level: 0 | 1 | 2 | 3) => {
    if (level <= 1) return deep
    return roles.cta.icon
  }

  const getStreakBadge = () => {
    if (streakDays >= 30) return "30-Day Legend"
    if (streakDays >= 14) return "14-Day Champion"
    if (streakDays >= 7) return "7-Day Warrior"
    if (streakDays >= 3) return "3-Day Starter"
    return null
  }

  const badge = getStreakBadge()

  if (loading) {
    return <CodebenchStreakSkeleton />
  }

  const calendarPanel = (
    <div className={cn("p-4 sm:p-5", embedInDashboard ? EMBED_MATERIAL_PANEL : "rounded-xl border border-slate-700/50 bg-slate-900/80 p-6")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <SolidListThumbTile thumb={roles.icon} icon={Calendar} size="compact" />
          <div>
            <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Activity Calendar</h2>
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
              {usingDemo
                ? "Preview heat map — click a day (frontend only)"
                : "Last 30 days — click a day for details"}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className={cn("text-center text-[10px] font-semibold uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Activity calendar">
        {calendarDays.map((day) => {
          const isSelected = selected?.key === day.key
          const fill = heatFill(day.level)
          return (
            <button
              key={day.key}
              type="button"
              role="gridcell"
              aria-pressed={isSelected}
              aria-label={`${day.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })} — ${day.active ? `active level ${day.level}` : "no activity"}`}
              onClick={() => setSelectedKey(day.key)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-all",
                "hover:scale-[1.06] hover:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2",
                !day.active && "border border-[var(--border)] bg-[var(--muted)]/35 hover:bg-[var(--muted)]/55",
                day.isToday && !isSelected && "ring-2 ring-[var(--cc-accent)]/50",
                isSelected && "ring-2 ring-[var(--cc-accent)] ring-offset-2 ring-offset-[var(--card)] scale-[1.06] z-10 shadow-md",
              )}
              style={
                day.active
                  ? {
                      backgroundColor: fill,
                      color: heatInk(day.level),
                      boxShadow: isSelected ? `0 8px 18px -8px ${accent}99` : undefined,
                    }
                  : undefined
              }
            >
              {day.date.getDate()}
            </button>
          )
        })}
      </div>

      <div className={cn("mt-4 flex items-center justify-between text-xs", PORTAL_TEXT_MUTED)}>
        <span className="font-medium">Less</span>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border border-[var(--border)] bg-[var(--muted)]/40" />
          <div className="h-3 w-3 rounded" style={{ backgroundColor: soft }} />
          <div className="h-3 w-3 rounded" style={{ backgroundColor: mid }} />
          <div className="h-3 w-3 rounded" style={{ backgroundColor: accent }} />
        </div>
        <span className="font-medium">More</span>
      </div>

      {selected ? (
        <div
          className="mt-4 rounded-xl border border-[var(--border)] p-3 sm:p-4"
          style={{ backgroundColor: `${soft}55` }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className={cn("text-sm font-semibold", PORTAL_TEXT)}>
                {selected.date.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {selected.isToday ? " · Today" : ""}
              </p>
              <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                {selected.active
                  ? `Coding activity logged (intensity ${selected.level}/3)`
                  : "No CodeBench activity on this day"}
              </p>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{
                backgroundColor: selected.active ? accent : "var(--muted)",
                color: selected.active ? roles.cta.icon : undefined,
              }}
            >
              {selected.active ? "Active" : "Idle"}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  )

  if (embedInDashboard) {
    return (
      <div className="space-y-5">
        <div className={cn("p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
          <div className="mb-4 flex items-center gap-2.5">
            <SolidListThumbTile thumb={codebenchChromeKpi(0, roles)} icon={Flame} size="compact" />
            <h2 className={cn("text-lg font-semibold", PORTAL_TEXT)}>Current Streak</h2>
          </div>
          <div className="py-4 text-center">
            <div className={cn("mb-2 text-6xl font-bold tabular-nums", PORTAL_TEXT)}>{streakDays}</div>
            <div className={cn("mb-4 text-lg", PORTAL_TEXT_MUTED)}>days in a row</div>
            {badge ? (
              <div
                className="mt-2 inline-block rounded-xl px-5 py-2.5 text-sm font-bold"
                style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
              >
                {badge}
              </div>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-[var(--muted)]/35 p-3">
                <div className={PORTAL_TEXT_MUTED}>Total Activities</div>
                <div className={cn("text-xl font-bold tabular-nums", PORTAL_TEXT)}>
                  {activityStats.totalSubmissions}
                </div>
              </div>
              <div className="rounded-xl bg-[var(--muted)]/35 p-3">
                <div className={PORTAL_TEXT_MUTED}>Active Days</div>
                <div className={cn("text-xl font-bold tabular-nums", PORTAL_TEXT)}>
                  {activityStats.activeDays}
                </div>
              </div>
            </div>
          </div>
        </div>

        {calendarPanel}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-6 shadow-xl backdrop-blur-sm">
        <div className="mb-4 flex items-center gap-3 text-xl font-semibold">
          <SolidListThumbTile thumb={codebenchChromeKpi(0, roles)} icon={Flame} size="compact" />
          <span className={PORTAL_TEXT}>Current Streak</span>
        </div>
        <div className="py-6 text-center">
          <div className={cn("mb-3 text-6xl font-bold", PORTAL_TEXT)}>{streakDays}</div>
          <div className={cn("mb-4 text-lg", PORTAL_TEXT_MUTED)}>days in a row</div>
        </div>
      </div>
      {calendarPanel}
    </div>
  )
}
