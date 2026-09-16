"use client"

import { use } from "react"
import { FlashcardDeckEditor } from "@/components/student/flashcards/flashcard-deck-editor"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function FlashcardEditPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = use(params)
  const id = Number(deckId)

  return (
    <div className={dashboardV2PageRootClass}>
      {Number.isFinite(id) ? <FlashcardDeckEditor deckId={id} /> : null}
    </div>
  )
}
