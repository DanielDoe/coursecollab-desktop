"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const PracticeBadgesDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PracticeBadgesDashboardV2").then((m) => ({
      default: m.PracticeBadgesDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function PracticeHubBadgesPage() {
  return <PracticeBadgesDashboardV2 />
}
