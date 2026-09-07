import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { generateFlashcardsFromQuestionBank } from "@/lib/flashcard-bank-generate"
import { fetchFlashcardDeckById, fetchFlashcardCardsForDeck, mapFlashcardCard, mapFlashcardDeck } from "@/lib/flashcards"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      topicName?: string
      session?: string | null
      deckId?: number | null
      maxCards?: number
    }

    const topicName = String(body.topicName ?? "").trim()
    if (!topicName) {
      return NextResponse.json({ error: "topicName is required" }, { status: 400 })
    }

    const result = await generateFlashcardsFromQuestionBank({
      courseId: scope.course.id,
      instructorId: scope.instructorId,
      courseCode: scope.course.course_code,
      topicName,
      session: body.session ?? null,
      deckId: body.deckId ?? null,
      maxCards: body.maxCards,
    })

    const deck = await fetchFlashcardDeckById(result.deckId)
    const cards = deck ? await fetchFlashcardCardsForDeck(result.deckId) : []

    return NextResponse.json({
      success: true,
      deckId: result.deckId,
      cardsAdded: result.cardsAdded,
      skipped: result.skipped,
      deck: deck ? mapFlashcardDeck(deck, true) : null,
      cards: cards.map(mapFlashcardCard),
    })
  } catch (error) {
    console.error("[instructor/flashcards/generate-from-bank POST]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate flashcards" },
      { status: 500 },
    )
  }
}
