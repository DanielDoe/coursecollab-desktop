"use client"

import { useSearchParams } from "next/navigation"
import { CourseExchangePanel } from "@/components/instructor/CourseExchangePanel"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"

const TAB_MAP: Record<string, "discover" | "received" | "sent" | "shared-with-me" | "my-shared" | "share-settings"> = {
  discover: "discover",
  received: "received",
  sent: "sent",
  "shared-with-me": "shared-with-me",
  "my-shared": "my-shared",
  "share-settings": "share-settings",
}

export default function CourseExchangePage() {
  const params = useSearchParams()
  const tabParam = params.get("tab") ?? "discover"
  const initialTab = TAB_MAP[tabParam] ?? "discover"
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <CourseExchangePanel initialTab={initialTab} />
    </StudentDashboardModulePage>
  )
}
