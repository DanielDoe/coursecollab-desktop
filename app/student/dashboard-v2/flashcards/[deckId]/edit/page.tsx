"use client"

import { useParams } from "next/navigation"
import { FlashcardDeckEditor } from "@/components/student/flashcards/flashcard-deck-editor"
import { dashboardV2PageRootClass } from "@/lib/dashboard-v2-layout"

export default function FlashcardEditPage() {
  const params = useParams()
  const id = Number(typeof params?.deckId === "string" ? params.deckId : "")

  return (
    <div className={dashboardV2PageRootClass}>
      {Number.isFinite(id) ? <FlashcardDeckEditor deckId={id} /> : null}
    </div>
  )
}
