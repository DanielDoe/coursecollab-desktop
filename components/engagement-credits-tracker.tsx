"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Sparkles, Brain, Code, BookOpen, ScrollText, Trophy } from "lucide-react"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { EMBED_LIST, EMBED_LIST_TILE } from "@/components/student/dashboard-v2/embed-module-ui"

interface EngagementCreditsTrackerProps {
  studentId: number
  session: string
}

const ACTIVITIES = [
  { key: "practice_hub_credits", label: "Practice Hub", icon: Brain, fill: "var(--cc-accent)" },
  { key: "playground_credits", label: "Playground", icon: Code, fill: "#22D3EE" },
  { key: "lecture_reading_credits", label: "Lecture Reading", icon: BookOpen, fill: "#10B981" },
  { key: "syllabus_credits", label: "Syllabus Review", icon: ScrollText, fill: "#64748B" },
] as const

export function EngagementCreditsTracker({ studentId, session }: EngagementCreditsTrackerProps) {
  const [loading, setLoading] = useState(true)
  const [credits, setCredits] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/engagement-credits?studentId=${studentId}&session=${session}`).then((r) => r.json()),
      studentApiFetch(`/api/grades/student?studentId=${studentId}&session=${session}`, {
        headers: getStudentAuthHeaders(),
      }).then((r) => r.json()),
    ])
      .then(([creditsData, gradeData]) => {
        if (creditsData.credits) {
          setCredits({
            total_credits: Number(creditsData.credits.total_credits) || 0,
            practice_hub_credits: Number(creditsData.credits.practice_hub_credits) || 0,
            playground_credits: Number(creditsData.credits.playground_credits) || 0,
            lecture_reading_credits: Number(creditsData.credits.lecture_reading_credits) || 0,
            syllabus_credits: Number(creditsData.credits.syllabus_credits) || 0,
          })
        } else if (gradeData.grade) {
          setCredits({
            total_credits: Number(gradeData.grade.engagement_credits) || 0,
            practice_hub_credits: 0,
            playground_credits: 0,
            lecture_reading_credits: 0,
            syllabus_credits: 0,
          })
        } else {
          setCredits({
            total_credits: 0,
            practice_hub_credits: 0,
            playground_credits: 0,
            lecture_reading_credits: 0,
            syllabus_credits: 0,
          })
        }
      })
      .catch(() =>
        setCredits({
          total_credits: 0,
          practice_hub_credits: 0,
          playground_credits: 0,
          lecture_reading_credits: 0,
          syllabus_credits: 0,
        }),
      )
      .finally(() => setLoading(false))
  }, [studentId, session])

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--cc-accent)]" />
        <p className="mt-3 text-sm text-[var(--cc-text-muted)]">Loading engagement credits…</p>
      </div>
    )
  }

  const totalCredits = Number(credits?.total_credits) || 0
  const maxCredits = 100
  const pct = Math.min((totalCredits / maxCredits) * 100, 100)

  return (
    <div className="space-y-4">
      <div className="space-y-2 border-b border-[var(--border)] pb-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--cc-text-muted)]">
              Engagement credits
            </p>
            <p className="mt-1 text-sm text-[var(--cc-text-muted)]">
              Practice, playground, lectures, and syllabus
            </p>
          </div>
          <p className="text-2xl font-semibold tabular-nums text-[var(--cc-text)]">
            {totalCredits.toFixed(1)}
            <span className="ml-1 text-sm font-medium text-[var(--cc-text-muted)]">/ {maxCredits}</span>
          </p>
        </div>
        <Progress
          value={pct}
          className="h-1.5 bg-[var(--muted)] [&_[data-slot=progress-indicator]]:bg-[var(--cc-accent)]"
        />
      </div>

      <div className={EMBED_LIST}>
        {ACTIVITIES.map((activity) => {
          const Icon = activity.icon
          const val = Number(credits?.[activity.key]) || 0
          return (
            <div key={activity.key} className={cn(EMBED_LIST_TILE, "flex min-h-[88px] items-center gap-3")}>
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-[14px]"
                style={{ backgroundColor: activity.fill, color: "#FFFFFF" }}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--cc-text)]">{activity.label}</p>
                <p className="text-xs text-[var(--cc-text-muted)]">Credits earned</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--cc-text)]">
                {val.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-[var(--cc-text-muted)]">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />
        Coming soon: trade 100 engagement credits for +1 bonus point
      </p>
    </div>
  )
}
