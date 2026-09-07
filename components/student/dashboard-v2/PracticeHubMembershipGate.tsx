"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Crown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SolidListThumbTile } from "@/components/student/dashboard-v2/SignatureListCard"
import { EMBED_MATERIAL_PANEL } from "@/components/student/dashboard-v2/embed-module-ui"
import { resolveStudentDatabaseId, studentApiFetch } from "@/lib/auth"
import { canAccessPracticeHub, PRACTICE_HUB_MIN_TIER } from "@/lib/practice-hub-access"
import type { MembershipTier } from "@/lib/membership-constants"
import { DEV_MODE_UNRESTRICTED_ACCESS } from "@/lib/membership-constants"
import { usePracticeChrome } from "@/hooks/use-practice-chrome"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"

export function PracticeHubMembershipGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { roles } = usePracticeChrome()
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState<MembershipTier | null>(null)

  useEffect(() => {
    const id = resolveStudentDatabaseId()
    if (!id) {
      router.push("/student/login")
      return
    }

    void (async () => {
      try {
        const res = await studentApiFetch(`/api/student/membership?studentId=${id}`)
        if (res.ok) {
          const data = await res.json()
          setTier((data.membership?.effectiveFeatureTier ?? data.membership?.tier ?? "Scholar") as MembershipTier)
        } else {
          setTier("Scholar")
        }
      } catch {
        setTier("Scholar")
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--cc-text-muted)]" aria-hidden />
      </div>
    )
  }

  if (!DEV_MODE_UNRESTRICTED_ACCESS && !canAccessPracticeHub(tier)) {
    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:p-5",
          EMBED_MATERIAL_PANEL,
        )}
      >
        <SolidListThumbTile thumb={roles.hero} icon={Crown} />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-[var(--cc-text)]">{PRACTICE_HUB_MIN_TIER} required</h3>
          <p className="mt-0.5 text-sm text-[var(--cc-text-muted)]">
            Practice Hub topics, sessions, and leaderboard unlock with {PRACTICE_HUB_MIN_TIER} membership
            or higher.
          </p>
        </div>
        <Button
          className="shrink-0 rounded-xl border-0 shadow-sm hover:opacity-90"
          style={{ backgroundColor: roles.cta.fill, color: roles.cta.icon }}
          asChild
        >
          <Link href="/student/dashboard-v2/membership">View plans</Link>
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
