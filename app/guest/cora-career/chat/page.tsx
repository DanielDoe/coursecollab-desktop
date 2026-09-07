"use client"

import dynamic from "next/dynamic"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const GuestCoraDashboard = dynamic(
  () => import("@/components/guest/GuestCoraDashboard").then((m) => ({ default: m.GuestCoraDashboard })),
  { loading: () => <ModulePageSkeleton className="min-h-[420px]" /> },
)

export default function GuestCoraCareerChatPage() {
  return (
    <GuestModulePage bodyClassName="p-3 sm:p-4" immersive>
      <GuestCoraDashboard />
    </GuestModulePage>
  )
}
