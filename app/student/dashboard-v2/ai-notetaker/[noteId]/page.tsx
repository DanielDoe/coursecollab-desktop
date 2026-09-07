"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { NotetakerClientGate } from "@/components/ai-notetaker/notetaker-client-gate"
import { NotetakerNoteDetail } from "@/components/ai-notetaker/notetaker-note-detail"

function DetailShell({ noteRef }: { noteRef: string }) {
  return <NotetakerNoteDetail noteRef={noteRef} />
}

export default function DashboardV2AiNotetakerNotePage() {
  const params = useParams()
  const noteId = typeof params?.noteId === "string" ? params.noteId : ""
  return (
    <div className="space-y-6">
      <NotetakerClientGate>
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center text-slate-500">Loading…</div>
          }
        >
          {noteId ? <DetailShell noteRef={noteId} /> : null}
        </Suspense>
      </NotetakerClientGate>
    </div>
  )
}
