"use client"

import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"
import { useNativeApp } from "@/hooks/use-native-app"

const StudentNotesUnifiedPage = dynamic(
  () => import("@/components/student/digital-notes/student-notes-native-page").then((m) => m.StudentNotesUnifiedPage),
  { ssr: false },
)

export default function DashboardV2NotesPage() {
  const isNativeApp = useNativeApp()
  const searchParams = useSearchParams()
  const initialNoteId = Number(searchParams.get("noteId") || "")
  const noteId =
    Number.isFinite(initialNoteId) && initialNoteId > 0 ? initialNoteId : null

  if (isNativeApp) {
    return (
      <div className={dashboardV2PageRootClass}>
        <StudentNotesUnifiedPage nativeLayout initialNoteId={noteId} />
      </div>
    )
  }

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-5">
          <StudentNotesUnifiedPage initialNoteId={noteId} />
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
