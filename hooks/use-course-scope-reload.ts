"use client"

import { useEffect } from "react"
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context"

/** Re-run an effect whenever the instructor switches courses. */
export function useCourseScopeReload(effect: () => void | (() => void)) {
  const { courseScopeVersion } = useInstructorDashboardV2()

  useEffect(effect, [courseScopeVersion, effect])
}
