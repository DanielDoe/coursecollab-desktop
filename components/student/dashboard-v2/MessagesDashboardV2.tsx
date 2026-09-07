"use client"

import dynamic from "next/dynamic"
import { Suspense, useCallback, useMemo, useState } from "react"
import { PenLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StudentModuleHubLayout } from "@/components/student/dashboard-v2/StudentModuleHubLayout"
import { ModuleListSkeleton } from "@/components/data/module-list-skeleton"

const MessagesInbox = dynamic(
  () => import("@/components/messages/MessagesInbox").then((m) => ({ default: m.MessagesInbox })),
  { ssr: false },
)

export function MessagesDashboardV2() {
  const [startCompose, setStartCompose] = useState(false)

  const metaLine = useMemo(() => "Direct messages with instructors and classmates", [])

  const handleComposeOpenChange = useCallback((open: boolean) => {
    if (!open) setStartCompose(false)
  }, [])

  const headerAction = (
    <Button
      type="button"
      className="h-9 shrink-0 rounded-xl border-0 px-3 shadow-none hover:opacity-90"
      style={{ backgroundColor: "var(--cc-accent)", color: "#fff" }}
      onClick={() => setStartCompose(true)}
    >
      <PenLine className="h-4 w-4 sm:mr-1.5" />
      <span className="hidden sm:inline">New message</span>
    </Button>
  )

  return (
    <StudentModuleHubLayout
      moduleId="messages"
      title="Messages"
      metaLine={metaLine}
      metaSuffix="pick a thread or start a new conversation"
      headerAction={headerAction}
      hideSideMenu
      menuView="inbox"
      onMenuSelect={() => {}}
      menuItems={[]}
    >
      <Suspense fallback={<ModuleListSkeleton rows={8} className="min-h-[520px]" />}>
        <MessagesInbox
          portal="student"
          hubLayout
          startCompose={startCompose}
          onComposeOpenChange={handleComposeOpenChange}
        />
      </Suspense>
    </StudentModuleHubLayout>
  )
}
