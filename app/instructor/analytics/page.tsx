"use client"

import dynamic from "next/dynamic"

const InstructorAdvancedAnalytics = dynamic(
  () => import("@/components/instructor-advanced-analytics").then((m) => m.InstructorAdvancedAnalytics),
  { ssr: false },
)

export default function InstructorAnalyticsPage() {
  return <InstructorAdvancedAnalytics />
}
