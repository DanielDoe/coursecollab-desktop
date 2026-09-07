"use client"

import dynamic from "next/dynamic"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { useDashboardV2 } from "@/components/student/dashboard-v2/DashboardV2Context"
import { cn } from "@/lib/utils"

const AITutorDashboardV2 = dynamic(
  () =>
    import("@/components/student/dashboard-v2/AITutorDashboardV2").then((m) => ({
      default: m.AITutorDashboardV2,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2AITutorPage() {
  const { coraImmersive } = useDashboardV2()

  return (
    <PageEnter
      className={cn("w-full min-w-0", coraImmersive && "flex min-h-0 flex-1 flex-col overflow-hidden")}
    >
      <EmbedModuleCard
        className={cn(coraImmersive && "flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-none")}
      >
        <div className={cn(coraImmersive ? "flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4" : "p-4 sm:p-5")}>
          <AITutorDashboardV2 />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
