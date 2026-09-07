import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  ensureFlashcardSchema,
  mapFlashcardCard,
  normalizeFlashcardDifficulty,
  refreshFlashcardDeckCount,
  type FlashcardCardRow,
} from "@/lib/flashcards"

export const dynamic = "force-dynamic"

async function getOwnedCard(cardId: number, studentDbId: number) {
  const rows = await sql`
    SELECT c.*, d.student_id, d.deck_kind
    FROM flashcard_cards c
    JOIN flashcard_decks d ON d.id = c.deck_id
    WHERE c.id = ${cardId}
    LIMIT 1
  `
  if (rows.length === 0) return null
  const row = rows[0] as FlashcardCardRow & { student_id: number | null; deck_kind: string }
  if (row.deck_kind !== "student" || Number(row.student_id) !== studentDbId) return null
  return row
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const cardId = Number((await params).cardId)
    if (!Number.isFinite(cardId) || cardId <= 0) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 })
    }

    const existing = await getOwnedCard(cardId, auth.studentDbId)
    if (!existing) {
      return NextResponse.json({ error: "Card not found or not editable" }, { status: 403 })
    }

    const body = (await request.json()) as {
      frontText?: string
      backText?: string
      sortOrder?: number
      difficulty?: string
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
        updated_at = NOW()
      WHERE id = ${cardId}
      RETURNING *
    `
    await refreshFlashcardDeckCount(Number(existing.deck_id))

    return NextResponse.json({ card: mapFlashcardCard(rows[0] as never) })
  } catch (error) {
    console.error("[student/flashcards/cards/[cardId] PATCH]", error)
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const cardId = Number((await params).cardId)
    if (!Number.isFinite(cardId) || cardId <= 0) {
      return NextResponse.json({ error: "Invalid card id" }, { status: 400 })
    }

    const existing = await getOwnedCard(cardId, auth.studentDbId)
    if (!existing) {
      return NextResponse.json({ error: "Card not found or not editable" }, { status: 403 })
    }

    await sql`DELETE FROM flashcard_cards WHERE id = ${cardId}`
    await refreshFlashcardDeckCount(Number(existing.deck_id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[student/flashcards/cards/[cardId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete card" }, { status: 500 })
  }
}
