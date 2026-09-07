"use client"

import dynamic from "next/dynamic"

const PracticeQuizPage = dynamic(
  () => import("@/app/student/practice/quiz/page").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="animate-pulse text-slate-600 dark:text-slate-400">Loading practice quiz...</div>
      </div>
    ),
  }
)

export default function DashboardV2PracticeQuizPage() {
  return <PracticeQuizPage embedded />
}
