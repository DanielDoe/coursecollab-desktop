"use client"

import { instructorApiFetch } from "@/lib/instructor-api-headers"
import { useEffect, useState, type ReactNode } from "react"
import {
  InstructorAdminQuickLink,
  InstructorPolicyDividedList,
  InstructorPolicySurfaceCard,
} from "@/components/instructor/InstructorPolicySurfaceCard"
import { InstructorPolicyLoadingState } from "@/components/instructor/InstructorPolicyLoadingState"
import { InstructorPlaygroundPoliciesPanel } from "@/components/instructor/InstructorPlaygroundPoliciesPanel"
import { useInstructorPlaygroundPolicy } from "@/components/instructor/useInstructorPlaygroundPolicy"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers"
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

export function InstructorPlaygroundRulesHub() {
  const policyState = useInstructorPlaygroundPolicy()
  const { loading } = policyState
  const { courseScopeVersion } = useInstructorDashboardV2()
  const [availableClassSessions, setAvailableClassSessions] = useState<
    Array<{ id: number; code: string; description?: string }>
  >([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const response = await instructorApiFetch("/api/instructor/sessions", {
          headers: getInstructorScopeHeaders(),
        })
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (cancelled) return
        setAvailableClassSessions(
          (data.sessions ?? []).map((s: { id: number; code: string; description?: string }) => ({
            id: s.id,
            code: s.code,
            description: s.description ?? "",
          })),
        )
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [courseScopeVersion])

  if (loading) {
    return <InstructorPolicyLoadingState moduleId="playground-rules" label="Loading playground rules…" />
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <InstructorPolicySurfaceCard className="w-full">
        <InstructorPlaygroundPoliciesPanel
          bare
          availableClassSessions={availableClassSessions}
          policyState={policyState}
        />

        <PolicyBlock title="Related">
          <InstructorPolicyDividedList>
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/course/playground`}
              label="Playground management"
              description="Start lobbies, pick questions, and edit rules in the live workspace"
              variant="row"
            />
            <InstructorAdminQuickLink
              href={`${FACULTY_DASHBOARD_BASE}/administration/classroom-points-rules`}
              label="Classroom points rules"
              description="Engagement sync and participation rewards settings"
              variant="row"
            />
          </InstructorPolicyDividedList>
        </PolicyBlock>
      </InstructorPolicySurfaceCard>
    </div>
  )
}
