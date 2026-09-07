import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  mapFlashcardCard,
  normalizeFlashcardDifficulty,
  parseFlashcardCustomDistractors,
  refreshFlashcardDeckCount,
  type FlashcardCardRow,
} from "@/lib/flashcards"

export const dynamic = "force-dynamic"

async function getInstructorOwnedCard(cardId: number, courseId: number) {
  const rows = await sql`
    SELECT c.*, d.course_id, d.deck_kind
    FROM flashcard_cards c
    JOIN flashcard_decks d ON d.id = c.deck_id
    WHERE c.id = ${cardId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as FlashcardCardRow & { deck_kind: string; course_id: number | null; deck_id: number }
  if (row.deck_kind !== "course" || Number(row.course_id) !== courseId) return null
  return row
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const cardId = Number((await params).cardId)
    const existing = await getInstructorOwnedCard(cardId, scope.course.id)
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      frontText?: string
      backText?: string
      sortOrder?: number
      difficulty?: string
      customDistractors?: string[]
    }

    const frontText =
      body.frontText != null ? String(body.frontText).trim() : String(existing.front_text)
    const backText =
      body.backText != null ? String(body.backText).trim() : String(existing.back_text)
    if (!frontText || !backText) {
      return NextResponse.json({ error: "Front and back text required" }, { status: 400 })
    }
    const sortOrder =
      body.sortOrder != null && Number.isFinite(Number(body.sortOrder))
        ? Number(body.sortOrder)
        : Number(existing.sort_order) || 0
    const customDistractors =
      body.customDistractors !== undefined
        ? JSON.stringify(parseFlashcardCustomDistractors(body.customDistractors))
        : JSON.stringify(parseFlashcardCustomDistractors(existing.custom_distractors))
    const difficulty =
      body.difficulty != null
        ? normalizeFlashcardDifficulty(body.difficulty)
        : normalizeFlashcardDifficulty(existing.difficulty)

    const rows = await sql`
      UPDATE flashcard_cards
      SET
        front_text = ${frontText},
        back_text = ${backText},
        sort_order = ${sortOrder},
        difficulty = ${difficulty},
        custom_distractors = ${customDistractors}::jsonb,
        updated_at = NOW()
      WHERE id = ${cardId}
      RETURNING *
    `
    await refreshFlashcardDeckCount(Number(existing.deck_id))

    return NextResponse.json({ card: mapFlashcardCard(rows[0] as never) })
  } catch (error) {
    console.error("[instructor/flashcards/cards/[cardId] PATCH]", error)
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const cardId = Number((await params).cardId)
    const existing = await getInstructorOwnedCard(cardId, scope.course.id)
    if (!existing) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 })
    }

    await sql`
      UPDATE flashcard_cards
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${cardId}
    `
    await refreshFlashcardDeckCount(Number(existing.deck_id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/flashcards/cards/[cardId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
  }
}
