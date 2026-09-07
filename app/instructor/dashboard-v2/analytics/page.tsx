"use client"

import { Suspense } from "react"
import { FacultyAnalyticsHub, FacultyAnalyticsHubFallback } from "@/components/instructor/analytics/FacultyAnalyticsHub"

export default function FacultyAnalyticsHubPage() {
  return (
    <Suspense fallback={<FacultyAnalyticsHubFallback />}>
      <FacultyAnalyticsHub />
    </Suspense>
  )
}
