"use client"

import { useParams } from "next/navigation"
import { FlashcardStudySession } from "@/components/student/flashcards/flashcard-study-session"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"

export default function FlashcardStudyPage() {
  const params = useParams()
  const id = Number(typeof params?.deckId === "string" ? params.deckId : "")

  return (
    <PageEnter className={dashboardV2PageRootClass}>
      <EmbedModuleCard>
        <div className="p-4 sm:p-6">
          {Number.isFinite(id) ? <FlashcardStudySession deckId={id} /> : null}
        </div>
      </EmbedModuleCard>
    </PageEnter>
  )
}
