import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { ensureFlashcardSchema, mapFlashcardCard, mapFlashcardDeck } from "@/lib/flashcards"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const decks = await sql`
      SELECT *
      FROM flashcard_decks
      WHERE deck_kind = 'course'
        AND course_id = ${scope.course.id}
        AND deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `

    const cards = await sql`
      SELECT c.*, d.title AS deck_title, d.topic AS deck_topic
      FROM flashcard_cards c
      JOIN flashcard_decks d ON d.id = c.deck_id
      WHERE d.deck_kind = 'course'
        AND d.course_id = ${scope.course.id}
        AND c.deleted_at IS NOT NULL
        AND d.deleted_at IS NULL
      ORDER BY c.deleted_at DESC
    `

    return NextResponse.json({
      decks: (decks as never[]).map((d) => mapFlashcardDeck(d, true)),
      cards: cards.map((c) => ({
        ...mapFlashcardCard(c as never),
        deckTitle: String(c.deck_title ?? ""),
        deckTopic: c.deck_topic != null ? String(c.deck_topic) : null,
        deletedAt: String(c.deleted_at ?? ""),
      })),
    })
  } catch (error) {
    console.error("[instructor/flashcards/deleted GET]", error)
    return NextResponse.json({ error: "Failed to load deleted flashcards" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const body = (await request.json()) as { deckIds?: number[]; cardIds?: number[] }
    const deckIds = Array.isArray(body.deckIds) ? body.deckIds.filter(Number.isFinite) : []
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter(Number.isFinite) : []

    if (deckIds.length === 0 && cardIds.length === 0) {
      return NextResponse.json({ error: "deckIds or cardIds required" }, { status: 400 })
    }

    if (deckIds.length > 0) {
      await sql`
        UPDATE flashcard_decks
        SET deleted_at = NULL, updated_at = NOW()
        WHERE id = ANY(${deckIds})
          AND course_id = ${scope.course.id}
          AND deck_kind = 'course'
      `
      await sql`
        UPDATE flashcard_cards
        SET deleted_at = NULL, updated_at = NOW()
        WHERE deck_id = ANY(${deckIds}) AND deleted_at IS NOT NULL
      `
    }

    if (cardIds.length > 0) {
      await sql`
        UPDATE flashcard_cards c
        SET deleted_at = NULL, updated_at = NOW()
        FROM flashcard_decks d
        WHERE c.id = ANY(${cardIds})
          AND c.deck_id = d.id
          AND d.course_id = ${scope.course.id}
          AND d.deck_kind = 'course'
      `
    }

    return NextResponse.json({
      success: true,
      restoredDecks: deckIds.length,
      restoredCards: cardIds.length,
    })
  } catch (error) {
    console.error("[instructor/flashcards/deleted PATCH]", error)
    return NextResponse.json({ error: "Failed to restore flashcards" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const body = (await request.json()) as { deckIds?: number[]; cardIds?: number[] }
    const deckIds = Array.isArray(body.deckIds) ? body.deckIds.filter(Number.isFinite) : []
    const cardIds = Array.isArray(body.cardIds) ? body.cardIds.filter(Number.isFinite) : []

    if (deckIds.length === 0 && cardIds.length === 0) {
      return NextResponse.json({ error: "deckIds or cardIds required" }, { status: 400 })
    }

    let deletedCards = 0
    let deletedDecks = 0

    for (const cardId of cardIds) {
      const removed = await sql`
        DELETE FROM flashcard_cards c
        USING flashcard_decks d
        WHERE c.id = ${cardId}
          AND c.deck_id = d.id
          AND d.course_id = ${scope.course.id}
          AND c.deleted_at IS NOT NULL
        RETURNING c.id
      `
      deletedCards += removed.length
    }

    for (const deckId of deckIds) {
      await sql`DELETE FROM flashcard_study_events WHERE deck_id = ${deckId}`.catch(() => [])
      await sql`
        DELETE FROM flashcard_cards c
        USING flashcard_decks d
        WHERE c.deck_id = d.id
          AND d.id = ${deckId}
          AND d.course_id = ${scope.course.id}
      `
      const removed = await sql`
        DELETE FROM flashcard_decks
        WHERE id = ${deckId}
          AND course_id = ${scope.course.id}
          AND deleted_at IS NOT NULL
        RETURNING id
      `
      deletedDecks += removed.length
    }

    return NextResponse.json({ success: true, deletedDecks, deletedCards })
  } catch (error) {
    console.error("[instructor/flashcards/deleted DELETE]", error)
    return NextResponse.json({ error: "Failed to permanently delete flashcards" }, { status: 500 })
  }
}
