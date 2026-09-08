"use client"

import dynamic from "next/dynamic"
import { StudentDashboardModulePage } from "@/components/student/dashboard-v2/StudentDashboardModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const TradeCenterContent = dynamic(
  () => import("@/components/trade-center-content").then((m) => ({ default: m.TradeCenterContent })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function DashboardV2TradeCenterPage() {
  return (
    <StudentDashboardModulePage scrollMode="panel">
      <TradeCenterContent embedInDashboard />
    </StudentDashboardModulePage>
  )
}
