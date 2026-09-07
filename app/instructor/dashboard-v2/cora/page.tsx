"use client"

import dynamic from "next/dynamic"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { cn } from "@/lib/utils"

const FacultyCoraDashboard = dynamic(
  () =>
    import("@/components/cora/platform/FacultyCoraDashboard").then((m) => ({
      default: m.FacultyCoraDashboard,
    })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function FacultyCoraPage() {
  const { coraImmersive } = useInstructorDashboardV2()

  return (
    <PageEnter
      className={cn("w-full min-w-0", coraImmersive && "flex min-h-0 flex-1 flex-col overflow-hidden")}
    >
      <EmbedModuleCard
        className={cn(
          "min-w-0 overflow-hidden",
          coraImmersive && "flex min-h-0 flex-1 flex-col overflow-hidden border-0 shadow-none",
        )}
      >
        <div
          className={cn(
            "min-w-0 overflow-x-hidden",
            coraImmersive ? "flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4" : "p-2 sm:p-4 md:p-5",
          )}
        >
          <FacultyCoraDashboard />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
