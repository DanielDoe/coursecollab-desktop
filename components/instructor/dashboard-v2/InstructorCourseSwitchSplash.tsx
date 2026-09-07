"use client"

import { useInstructorDashboardV2 } from "./InstructorDashboardV2Context"
import { PortalWorkspaceLoading } from "@/components/dashboard-v2/PortalWorkspaceLoading"

/** Full-screen interstitial when the scoped course changes from the top bar. */
export function InstructorCourseSwitchSplash() {
  const { courseSwitchSplash: splash } = useInstructorDashboardV2()
  if (!splash) return null

  return (
    <PortalWorkspaceLoading
      fullScreen
      subtitle="Switching course"
      title={splash.title}
      detailMono={splash.code}
      detail="Refreshing modules and scoped data…"
    />
  )
}
