"use client"

import { use } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { ProjectGroupWorkspace } from "@/components/projects/ProjectGroupWorkspace"

export default function StudentProjectWorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = use(params)
  const id = Number.parseInt(projectId, 10)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          {Number.isFinite(id) ? <ProjectGroupWorkspace projectId={id} /> : null}
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
