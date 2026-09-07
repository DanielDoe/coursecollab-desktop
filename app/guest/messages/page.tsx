"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"
import { GuestModulePage } from "@/components/guest/dashboard/GuestModulePage"

const MessagesInbox = dynamic(
  () => import("@/components/messages/MessagesInbox").then((m) => ({ default: m.MessagesInbox })),
  { loading: () => <ModulePageSkeleton className="min-h-[480px]" /> },
)

export default function GuestMessagesPage() {
  return (
    <GuestModulePage bare>
      <Suspense fallback={<ModulePageSkeleton className="min-h-[480px]" />}>
        <MessagesInbox portal="guest" />
      </Suspense>
    </GuestModulePage>
  )
}
