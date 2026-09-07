import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  mapFlashcardCard,
  normalizeFlashcardDifficulty,
  refreshFlashcardDeckCount,
} from "@/lib/flashcards"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    const deck = await fetchFlashcardDeckById(deckId)
    if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== scope.course.id) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      frontText?: string
      backText?: string
      sortOrder?: number
      difficulty?: string
    }
    const frontText = String(body.frontText ?? "").trim()
    const backText = String(body.backText ?? "").trim()
    if (!frontText || !backText) {
      return NextResponse.json({ error: "Front and back text required" }, { status: 400 })
    }
    const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0
    const difficulty = normalizeFlashcardDifficulty(body.difficulty)

    const rows = await sql`
      INSERT INTO flashcard_cards (deck_id, front_text, back_text, sort_order, difficulty)
      VALUES (${deckId}, ${frontText}, ${backText}, ${sortOrder}, ${difficulty})
      RETURNING *
    `
    await refreshFlashcardDeckCount(deckId)

    return NextResponse.json({ card: mapFlashcardCard(rows[0] as never) })
  } catch (error) {
    console.error("[instructor/flashcards/decks/[deckId]/cards POST]", error)
    return NextResponse.json({ error: "Failed to add card" }, { status: 500 })
  }
}
