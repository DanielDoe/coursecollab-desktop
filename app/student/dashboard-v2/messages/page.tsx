"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { ModulePageSkeleton } from "@/components/student/dashboard-v2/ModulePageSkeleton"

const MessagesInbox = dynamic(
  () => import("@/components/messages/MessagesInbox").then((m) => ({ default: m.MessagesInbox })),
  { loading: () => <ModulePageSkeleton className="min-h-[480px]" /> },
)

export default function StudentMessagesPage() {
  return (
    <Suspense fallback={<ModulePageSkeleton className="min-h-[480px]" />}>
      <MessagesInbox portal="student" />
    </Suspense>
  )
}
