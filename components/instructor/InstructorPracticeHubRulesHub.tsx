"use client"

import type { ReactNode } from "react"
import {
  InstructorAdminQuickLink,
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPracticeHubPoliciesPanel } from "@/components/instructor/InstructorPracticeHubPoliciesPanel"
import { useInstructorPracticeHubPolicy } from "@/components/instructor/useInstructorPracticeHubPolicy"
import { FACULTY_DASHBOARD_BASE } from "@/lib/faculty-portal-nav-config"
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes"
import { cn } from "@/lib/utils"

function PolicyBlock({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-4 border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <div>
        <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{title}</h4>
        {description ? <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>{description}</p> : null}
      </div>
      {children}
    </div>
  )
}

export function InstructorPracticeHubRulesHub() {
  const policyState = useInstructorPracticeHubPolicy()
  const { loading } = policyState

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="practice-rules" label="Loading practice rules…" />
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard className="w-full">
        <InstructorPracticeHubPoliciesPanel bare policyState={policyState} />

        <PolicyBlock title="Related">
          <InstructorPolicyDividedList>
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/content/practice`}
              label="Practice management"
              description="Topics, student progress, session limits, and analytics"
              variant="row"
            />
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/administration/classroom-points-rules`}
              label="Classroom points rules"
              description="Engagement credits earned from practice sessions"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>
    </div>
  )
}
