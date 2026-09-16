"use client"

import { use } from "react"
import { FlashcardStudySession } from "@/components/student/flashcards/flashcard-study-session"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"
import { EmbedModuleCard } from "@/components/student/dashboard-v2/embed-module-ui"
import { PageEnter } from "@/components/student/dashboard-v2/light-motion"

export default function FlashcardStudyPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params)
  const id = Number(deckId)

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
