import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { clampFlashcardBatchSize } from "@/lib/flashcard-batch-study"
import {
  ensureFlashcardSchema,
  fetchFlashcardCardsForDeck,
  fetchFlashcardDeckById,
  mapFlashcardCard,
  mapFlashcardDeck,
} from "@/lib/flashcards"

export const dynamic = "force-dynamic"

async function authorizeInstructorDeck(deckId: number, courseId: number) {
  const deck = await fetchFlashcardDeckById(deckId)
  if (!deck || deck.deck_kind !== "course" || Number(deck.course_id) !== courseId) {
    return null
  }
  return deck
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    const deck = await authorizeInstructorDeck(deckId, scope.course.id)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

    const cards = await fetchFlashcardCardsForDeck(deckId)
    return NextResponse.json({
      deck: mapFlashcardDeck(deck, true),
      cards: cards.map(mapFlashcardCard),
    })
  } catch (error) {
    console.error("[instructor/flashcards/decks/[deckId] GET]", error)
    return NextResponse.json({ error: "Failed to load deck" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    const deck = await authorizeInstructorDeck(deckId, scope.course.id)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

    const body = (await request.json()) as {
      title?: string
      description?: string
      topic?: string
      session?: string | null
      showInPracticeHub?: boolean
      isPublished?: boolean
      requireMcqValidation?: boolean
      cardsBeforeQuiz?: number
    }

    const title = body.title != null ? String(body.title).trim() || "Untitled deck" : deck.title
    const description = body.description != null ? String(body.description) : deck.description
    const topic =
      body.topic !== undefined
        ? body.topic != null
          ? String(body.topic).trim() || null
          : null
        : deck.topic
    const sessionRaw = body.session !== undefined ? String(body.session ?? "").trim() : deck.session ?? ""
    const session = sessionRaw && sessionRaw !== "ALL" ? sessionRaw : null
    const showInPracticeHub =
      body.showInPracticeHub !== undefined ? Boolean(body.showInPracticeHub) : deck.show_in_practice_hub
    const isPublished = body.isPublished !== undefined ? Boolean(body.isPublished) : deck.is_published
    const requireMcqValidation =
      body.requireMcqValidation !== undefined
        ? Boolean(body.requireMcqValidation)
        : deck.require_mcq_validation !== false
    const cardsBeforeQuiz =
      body.cardsBeforeQuiz !== undefined
        ? clampFlashcardBatchSize(body.cardsBeforeQuiz)
        : clampFlashcardBatchSize(deck.cards_before_quiz)

    const rows = await sql`
      UPDATE flashcard_decks
      SET
        title = ${title},
        description = ${description},
        topic = ${topic},
        session = ${session},
        show_in_practice_hub = ${showInPracticeHub},
        is_published = ${isPublished},
        require_mcq_validation = ${requireMcqValidation},
        cards_before_quiz = ${cardsBeforeQuiz},
        updated_at = NOW()
      WHERE id = ${deckId} AND course_id = ${scope.course.id}
      RETURNING *
    `

    if (isPublished && !deck.is_published) {
      const { notifyCourseStudents } = await import("@/lib/notify-course-students")
      void notifyCourseStudents(
        { courseId: scope.course.id, sessionCode: session },
        {
          type: "flashcards",
          title: "New flashcard deck",
          message: `"${title}" is ready to study.`,
          link: "/student/dashboard-v2/flashcards",
        },
      ).catch((err) => console.warn("[flashcards] publish notify failed:", err))
    }

    return NextResponse.json({ deck: mapFlashcardDeck(rows[0] as never, true) })
  } catch (error) {
    console.error("[instructor/flashcards/decks/[deckId] PATCH]", error)
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    const deck = await authorizeInstructorDeck(deckId, scope.course.id)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

    await sql`
      UPDATE flashcard_decks
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${deckId} AND course_id = ${scope.course.id}
    `
    await sql`
      UPDATE flashcard_cards
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE deck_id = ${deckId} AND deleted_at IS NULL
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[instructor/flashcards/decks/[deckId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
  }
}
