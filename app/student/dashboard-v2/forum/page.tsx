"use client"

import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const ForumHub = dynamic(() => import("./forum-hub"), {
  loading: () => <ModulePageSkeleton className="min-h-[480px]" />,
})

export default function DashboardV2ForumPage() {
  return <ForumHub />
}
