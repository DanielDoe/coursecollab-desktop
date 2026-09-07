"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Award, Loader2 } from "lucide-react"
import { getStudentData } from "@/lib/auth"
import { getStudentCourseIdFromSession } from "@/lib/student-session-ids"
import { cn } from "@/lib/utils"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import {
  mergePracticeBadges,
  type PracticeEarnedBadge,
} from "@/lib/practice-badge-catalog"
import { PracticeBadgeCard } from "@/components/student/dashboard-v2/PracticeBadgeCard"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"

const JEANS_PANEL = cn(
  "rounded-xl border bg-white border-gray-200 shadow-md",
  "dark:border-white/15 dark:bg-[color-mix(in_srgb,var(--card)_78%,white)]",
  "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_8px_22px_rgba(0,0,0,0.45)]",
)

/** Practice Hub badges gallery — CodeBench-style crest cards + catalog unlocks. */
export function PracticeBadgesDashboardV2() {
  const router = useRouter()
  const { roles } = usePracticeChrome()
  const [loading, setLoading] = useState(true)
  const [earned, setEarned] = useState<PracticeEarnedBadge[]>([])

  useEffect(() => {
    const studentData = getStudentData()
    if (!studentData?.databaseId) {
      router.push("/student/login")
      return
    }

    const studentDbId = Number.parseInt(studentData.databaseId)
    const courseId = getStudentCourseIdFromSession()
    const session = studentData.section || ""
    const courseQs = courseId != null ? `&courseId=${courseId}` : ""

    void fetch(
      `/api/practice/leaderboard?studentId=${studentDbId}&session=${encodeURIComponent(session)}&limit=1${courseQs}`,
    )
      .then(async (res) => {
        if (!res.ok) return
        const data = await res.json()
        setEarned(Array.isArray(data.badges) ? data.badges : [])
      })
      .catch(() => setEarned([]))
      .finally(() => setLoading(false))
  }, [router])

  const badges = useMemo(() => mergePracticeBadges(earned), [earned])
  const unlockedCount = badges.filter((b) => b.unlocked).length

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center gap-2 text-gray-700 dark:text-[var(--cc-text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: roles.browse.ink }} />
        Loading badges…
      </div>
    )
  }

  return (
    <div className="min-w-0 space-y-5 pt-2">
      <div className={cn(JEANS_PANEL, "flex flex-wrap items-center gap-3 p-4 sm:p-5")}>
        <SolidListThumbTile thumb={roles.streak} icon={Award} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-[var(--cc-text)]">
            Practice badges
          </h2>
          <p className="text-sm text-gray-700 dark:text-[var(--cc-text-muted)]">
            Earn crests as you practice — {unlockedCount} of {badges.length} unlocked
          </p>
        </div>
        <div
          className="rounded-xl px-3 py-2 text-center"
          style={{ backgroundColor: `${roles.cta.fill}22` }}
        >
          <p className="text-2xl font-bold tabular-nums text-gray-800 dark:text-[var(--cc-text)]">
            {unlockedCount}
          </p>
          <p className="text-[11px] font-medium text-gray-700 dark:text-[var(--cc-text-muted)]">
            Unlocked
          </p>
        </div>
      </div>

      {/* pt compensates for floating crest -mt-5 so header and grid don’t collide */}
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-8 sm:grid-cols-2 xl:grid-cols-3">
        {badges.map((badge, index) => (
          <PracticeBadgeCard key={badge.id} badge={badge} colorIndex={index} />
        ))}
      </div>
    </div>
  )
}
