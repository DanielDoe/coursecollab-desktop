"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const PracticeHubDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/PracticeHubDashboardV2").then((m) => ({
      default: m.PracticeHubDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2PracticePage() {
  return <PracticeHubDashboardV2 />
}
