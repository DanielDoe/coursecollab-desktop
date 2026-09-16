"use client"

import { Suspense } from "react"
import { NotetakerClientGate } from "@/components/ai-notetaker/notetaker-client-gate"
import { NotetakerNewSession } from "@/components/ai-notetaker/notetaker-new-session"

export default function DashboardV2AiNotetakerNewPage() {
  return (
    <div className="space-y-6">
      <NotetakerClientGate>
        <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>}>
          <NotetakerNewSession />
        </Suspense>
      </NotetakerClientGate>
    </div>
  )
}
