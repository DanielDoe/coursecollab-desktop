"use client"

import dynamic from "next/dynamic"

const PracticeHistoryPage = dynamic(
  () => import("@/app/student/practice/history/page").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading practice history...</div>
      </div>
    ),
  }
)

export default function DashboardV2PracticeHistoryPage() {
  return <PracticeHistoryPage embedded />
}
