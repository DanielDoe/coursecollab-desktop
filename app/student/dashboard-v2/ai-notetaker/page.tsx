"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { NotetakerClientGate } from "@/components/ai-notetaker/notetaker-client-gate"
import { NotetakerHome } from "@/components/ai-notetaker/notetaker-home"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { isDesktopAppShell } from "@/lib/desktop-auth-policy"
import { useNativeApp } from "@/hooks/use-native-app"

function NotetakerHomeFromQuery() {
  const searchParams = useSearchParams()
  const raw = searchParams.get("mode")
  const sessionMode = raw === "upload" || raw === "record" ? raw : null
  return <NotetakerHome sessionMode={sessionMode} />
}

export default function DashboardV2AiNotetakerPage() {
  const isNativeApp = useNativeApp()

  if (isNativeApp) {
    return (
      <div className={dashboardV2PageRootClass}>
        <NotetakerClientGate>
          <NotetakerHome />
        </NotetakerClientGate>
      </div>
    )
  }

  const body = (
    <NotetakerClientGate>
      <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>}>
        <NotetakerHomeFromQuery />
      </Suspense>
    </NotetakerClientGate>
  )

  if (isDesktopAppShell()) {
    return (
      <PageEnter className={`${dashboardV2PageRootClass} flex min-h-0 flex-1 flex-col`}>
        <EmbedModuleCard className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4 md:p-5">{body}</div>
        </EmbedModuleCard>
      </PageEnter>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">{body}</div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
