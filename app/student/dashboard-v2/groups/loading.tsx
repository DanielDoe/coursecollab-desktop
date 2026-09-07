import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { GroupsPageSkeleton } from "@/components/student/dashboard-v2/GroupsPageSkeleton"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function Loading() {
  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <GroupsPageSkeleton />
      </EmbedModuleCard>
    </PageEnter>
  )
}
