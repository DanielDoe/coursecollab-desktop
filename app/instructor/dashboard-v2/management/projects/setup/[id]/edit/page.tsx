"use client"

import { use } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { ProjectEditForm } from "@/components/instructor/projects/ProjectEditForm"

export default function EditProjectSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const assignmentId = Number.parseInt(id, 10)

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="w-full min-w-0 p-3 sm:p-4 md:p-5">
          <ProjectEditForm assignmentId={Number.isFinite(assignmentId) ? assignmentId : undefined} />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
