"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { NotetakerClientGate } from "@/components/ai-notetaker/notetaker-client-gate"
import { NotetakerNewSession } from "@/components/ai-notetaker/notetaker-new-session"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { useNativeApp } from "@/hooks/use-native-app"

function RedirectCaptureToHome() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const mode = searchParams.get("mode") === "upload" ? "upload" : "record"
    router.replace(`/student/dashboard-v2/ai-notetaker?mode=${mode}`)
  }, [router, searchParams])

  return <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Opening…</div>
}

export default function DashboardV2AiNotetakerNewPage() {
  const isNativeApp = useNativeApp()

  if (isNativeApp) {
    return (
      <div className={dashboardV2PageRootClass}>
        <NotetakerClientGate>
          <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>}>
            <NotetakerNewSession />
          </Suspense>
        </NotetakerClientGate>
      </div>
    )
  }

  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-slate-500">Opening…</div>}>
      <RedirectCaptureToHome />
    </Suspense>
  )
}
