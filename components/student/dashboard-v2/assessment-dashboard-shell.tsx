"use client"

import type { ReactNode } from "react"
import { ExtendSelfServiceClosedBanner } from "@/components/student/ExtendSelfServiceClosedBanner"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { useAssessmentType } from "@/context/assessment-type-context"

export function AssessmentDashboardShell({
  main,
  sidebar,
}: {
  main: ReactNode
  sidebar?: ReactNode
}) {
  const assessmentConfig = useAssessmentType()
  const lead =
    assessmentConfig.assessmentType === "quiz"
      ? "Official and practice"
      : assessmentConfig.assessmentType === "homework"
        ? "Assigned work"
        : "Timed exams"

  return (
    <EmbedModuleCard>
      <div className="p-3 sm:p-4 md:p-5">
        <div className="mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--cc-text-muted)]">
            {assessmentConfig.pluralName}
          </p>
          <p className="mt-0.5 text-sm text-[var(--cc-text)]">
            {lead}
            <span className="text-[var(--cc-text-muted)]"> · start, continue, or review reports</span>
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3">
          <ExtendSelfServiceClosedBanner />
          <div className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] xl:items-stretch xl:gap-5">
            <div className="flex min-h-0 min-w-0 flex-col">{main}</div>
            {sidebar ? <div className="flex min-h-0 min-w-0 flex-col">{sidebar}</div> : null}
          </div>
        </div>
      </div>
    </EmbedModuleCard>
  )
}
