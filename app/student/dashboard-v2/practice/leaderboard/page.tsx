"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const PracticeLeaderboardDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PracticeLeaderboardDashboardV2").then((m) => ({
      default: m.PracticeLeaderboardDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function PracticeHubLeaderboardPage() {
  return <PracticeLeaderboardDashboardV2 />
}
