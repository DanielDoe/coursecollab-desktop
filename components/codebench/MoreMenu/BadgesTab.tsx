"use client"

import { useState, useEffect, useMemo } from "react"
import { Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { BadgeCard } from "./BadgeCard"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { useCodebenchChrome } from "@/hooks/use-codebench-chrome"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { getCodebenchBadgeCatalog } from "@/lib/codebench-badge-catalog"
import { CodebenchBadgesSkeleton } from "@/components/codebench/CodebenchSkeletons"

interface BadgesTabProps {
  embedInDashboard?: boolean
}

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: string
}

export function BadgesTab({ embedInDashboard }: BadgesTabProps = {}) {
  const { roles } = useCodebenchChrome()
  const catalog = useMemo(
    () =>
      getCodebenchBadgeCatalog().map((b) => ({
        ...b,
        unlocked: false,
        unlockedAt: undefined as string | undefined,
      })),
    [],
  )
  const [badges, setBadges] = useState<Badge[]>(catalog)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBadges = async () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("codebench_badges")
        if (saved) {
          try {
            const unlockedIds = JSON.parse(saved)
            setBadges((prev) =>
              prev.map((badge) => ({
                ...badge,
                unlocked: unlockedIds.includes(badge.id),
              })),
            )
            setLoading(false)
          } catch (e) {
            console.error("Failed to parse badges:", e)
          }
        }
      }

      try {
        const studentId = sessionStorage.getItem("studentDatabaseId")
        if (!studentId) {
          return
        }

        const response = await fetch(`/api/codebench/badges?studentId=${studentId}`)
        if (response.ok) {
          const data = await response.json()
          const unlockedIds = Object.keys(data.badges || {}).filter((id) => data.badges[id])
          const badgeDetails = data.badgeDetails || {}

          setBadges((prev) =>
            prev.map((badge) => {
              const isUnlocked = unlockedIds.includes(badge.id)
              const details = badgeDetails[badge.id]
              return {
                ...badge,
                unlocked: isUnlocked,
                unlockedAt: details?.earnedAt ? new Date(details.earnedAt).toISOString() : undefined,
              }
            }),
          )

          if (typeof window !== "undefined") {
            localStorage.setItem("codebench_badges", JSON.stringify(unlockedIds))
          }
        }
      } catch (error) {
        console.error("Failed to fetch badges:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchBadges()
  }, [])

  const unlockedCount = badges.filter((b) => b.unlocked).length
  const totalCount = badges.length

  if (loading) {
    return <CodebenchBadgesSkeleton />
  }

  if (embedInDashboard) {
    return (
      <div className="space-y-5">
        <div className={cn("flex items-center justify-between gap-4 p-4 sm:p-5", EMBED_MATERIAL_PANEL)}>
          <div className="flex items-center gap-3">
            <SolidListThumbTile thumb={roles.badge} icon={Award} />
            <div>
              <div className={cn("text-sm", PORTAL_TEXT_MUTED)}>Badges earned</div>
              <div className={cn("text-3xl font-bold tabular-nums", PORTAL_TEXT)}>
                {unlockedCount} / {totalCount}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map((badge, index) => (
            <BadgeCard key={badge.id} badge={badge} embedInDashboard colorIndex={index} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-700 bg-slate-800/50">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 text-sm text-slate-400">Badges Earned</div>
              <div className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-3xl font-bold text-transparent">
                {unlockedCount} / {totalCount}
              </div>
            </div>
            <Award className="h-12 w-12 text-yellow-400/50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge, index) => (
          <BadgeCard key={badge.id} badge={badge} colorIndex={index} />
        ))}
      </div>
    </div>
  )
}
