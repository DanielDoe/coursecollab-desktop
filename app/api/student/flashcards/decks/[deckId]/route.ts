import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import {
  ensureFlashcardSchema,
  fetchFlashcardCardsForDeck,
  fetchFlashcardDeckById,
  mapFlashcardCard,
  mapFlashcardDeck,
  studentCanEditDeck,
  studentCanStudyDeck,
} from "@/lib/flashcards"
import {
  defaultFlashcardCourseSettings,
  fetchFlashcardCourseSettings,
} from "@/lib/flashcard-course-settings"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { filterFlashcardCardsForTier } from "@/lib/flashcard-tier-access"
import {
  flashcardAccessForStudentClient,
} from "@/lib/flashcard-study-policy"

export const dynamic = "force-dynamic"

async function resolveStudentCourseContext(studentDbId: number) {
  const rows = await sql`
    SELECT s.section, c.id AS course_id
    FROM students s
    LEFT JOIN courses c ON c.id = s.course_id
    WHERE s.id = ${studentDbId} AND s.deleted_at IS NULL
    LIMIT 1
  `
  if (rows.length === 0) return { session: null as string | null, courseId: null as number | null }
  const row = rows[0] as { section: string | null; course_id: number | null }
  return {
    session: row.section ?? null,
    courseId: row.course_id != null ? Number(row.course_id) : null,
  }
}

async function authorizeDeckAccess(deckId: number, studentDbId: number) {
  const deck = await fetchFlashcardDeckById(deckId)
  if (!deck) return { ok: false as const, status: 404, error: "Deck not found" }
  const ctx = await resolveStudentCourseContext(studentDbId)
  if (!studentCanStudyDeck(deck, studentDbId, ctx.courseId, ctx.session)) {
    return { ok: false as const, status: 403, error: "Access denied" }
  }
  return {
    ok: true as const,
    deck,
    canEdit: studentCanEditDeck(deck, studentDbId),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    if (!Number.isFinite(deckId) || deckId <= 0) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 })
    }

    const access = await authorizeDeckAccess(deckId, auth.studentDbId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    const cardsAll = await fetchFlashcardCardsForDeck(deckId)
    const ctx = await resolveStudentCourseContext(auth.studentDbId)
    const courseSettings =
      access.deck.deck_kind === "course" && ctx.courseId != null
        ? await fetchFlashcardCourseSettings(ctx.courseId)
        : defaultFlashcardCourseSettings()

    let cards = cardsAll
    let tierAccess = flashcardAccessForStudentClient("Trailblazer", courseSettings.studyPolicy)

    if (access.deck.deck_kind === "course") {
      const tier = await getEffectiveMembershipTier(auth.studentDbId)
      tierAccess = flashcardAccessForStudentClient(tier, courseSettings.studyPolicy)
      cards = filterFlashcardCardsForTier(cardsAll, tier, courseSettings.studyPolicy)
    }

    return NextResponse.json({
      deck: mapFlashcardDeck(access.deck, access.canEdit),
      cards: cards.map(mapFlashcardCard),
      studySettings: {
        dailyGoal: courseSettings.dailyGoal,
        timedModeSeconds: courseSettings.timedModeSeconds,
        tierAccess,
        totalCards: cardsAll.length,
        unlockedCards: cards.length,
      },
    })
  } catch (error) {
    console.error("[student/flashcards/decks/[deckId] GET]", error)
    return NextResponse.json({ error: "Failed to load deck" }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    if (!Number.isFinite(deckId) || deckId <= 0) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 })
    }

    const access = await authorizeDeckAccess(deckId, auth.studentDbId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    if (!access.canEdit) {
      return NextResponse.json({ error: "You can only edit your own decks" }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      topic?: string
    }

    const title =
      body.title != null ? String(body.title).trim() || "Untitled deck" : access.deck.title
    const description = body.description != null ? String(body.description) : access.deck.description
    const topic =
      body.topic !== undefined
        ? body.topic != null
          ? String(body.topic).trim() || null
          : null
        : access.deck.topic

    const rows = await sql`
      UPDATE flashcard_decks
      SET title = ${title}, description = ${description}, topic = ${topic}, updated_at = NOW()
      WHERE id = ${deckId} AND student_id = ${auth.studentDbId}
      RETURNING *
    `

    return NextResponse.json({ deck: mapFlashcardDeck(rows[0] as never, true) })
  } catch (error) {
    console.error("[student/flashcards/decks/[deckId] PATCH]", error)
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const deckId = Number((await params).deckId)
    if (!Number.isFinite(deckId) || deckId <= 0) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 })
    }

    const access = await authorizeDeckAccess(deckId, auth.studentDbId)
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }
    if (!access.canEdit) {
      return NextResponse.json({ error: "You can only delete your own decks" }, { status: 403 })
    }

    await sql`DELETE FROM flashcard_decks WHERE id = ${deckId} AND student_id = ${auth.studentDbId}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[student/flashcards/decks/[deckId] DELETE]", error)
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 })
  }
}
