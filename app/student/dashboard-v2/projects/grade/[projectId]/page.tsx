"use client"

import { use } from "react"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { StudentGradedReport } from "@/components/projects/StudentGradedReport"

export default function StudentProjectGradePage({
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">Graded report</p>
          <div className="mt-3">
            {Number.isFinite(id) ? <StudentGradedReport projectId={id} persistent /> : null}
          </div>
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
