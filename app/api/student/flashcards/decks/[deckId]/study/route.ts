import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentSection } from "@/lib/auth"
import {
  ensureFlashcardSchema,
  fetchFlashcardDeckById,
  studentCanStudyDeck,
} from "@/lib/flashcards"
import {
  ensureFlashcardStudySchema,
  fetchFlashcardDeckProgress,
  recordFlashcardStudyEvent,
  type FlashcardStudyOutcome,
} from "@/lib/flashcard-study-engagement"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import {
  defaultFlashcardCourseSettings,
  fetchFlashcardCourseSettings,
} from "@/lib/flashcard-course-settings"
import {
  dailyCardCapForTier,
  flashcardAccessForStudentClient,
} from "@/lib/flashcard-study-policy"
import { fetchFlashcardCardsForDeck } from "@/lib/flashcards"
import { isFlashcardLockedForTier } from "@/lib/flashcard-tier-access"

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const { deckId: deckIdRaw } = await params
    const deckId = Number(deckIdRaw)
    if (!Number.isFinite(deckId)) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 })
    }

    await ensureFlashcardSchema()
    await ensureFlashcardStudySchema()

    const deck = await fetchFlashcardDeckById(deckId)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

    const ctx = await resolveStudentCourseContext(auth.studentDbId)
    if (!studentCanStudyDeck(deck, auth.studentDbId, ctx.courseId, ctx.session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const progress = await fetchFlashcardDeckProgress(auth.studentDbId, deckId)
    return NextResponse.json(progress)
  } catch (error) {
    console.error("[student/flashcards/decks/[deckId]/study GET]", error)
    return NextResponse.json({ error: "Failed to load study progress" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ deckId: string }> },
) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const { deckId: deckIdRaw } = await params
    const deckId = Number(deckIdRaw)
    if (!Number.isFinite(deckId)) {
      return NextResponse.json({ error: "Invalid deck id" }, { status: 400 })
    }

    const body = (await request.json()) as {
      cardId?: number
      outcome?: FlashcardStudyOutcome
      sessionId?: string
      streak?: number
      bonusType?: "timed" | "boss"
    }

    const outcome = body.outcome
    if (!outcome || !["known", "learning", "session_complete"].includes(outcome)) {
      return NextResponse.json({ error: "Invalid outcome" }, { status: 400 })
    }

    const sessionId = String(body.sessionId ?? "").trim()
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    if (outcome !== "session_complete" && !Number.isFinite(Number(body.cardId))) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 })
    }

    await ensureFlashcardSchema()
    await ensureFlashcardStudySchema()

    const deck = await fetchFlashcardDeckById(deckId)
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 })

    const ctx = await resolveStudentCourseContext(auth.studentDbId)
    if (!studentCanStudyDeck(deck, auth.studentDbId, ctx.courseId, ctx.session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const courseSettings =
      deck.deck_kind === "course" && ctx.courseId != null
        ? await fetchFlashcardCourseSettings(ctx.courseId)
        : defaultFlashcardCourseSettings()

    if (deck.deck_kind === "course") {
      const tier = await getEffectiveMembershipTier(auth.studentDbId)
      const access = flashcardAccessForStudentClient(tier, courseSettings.studyPolicy)
      if (!access.canStudyCourseDeck) {
        return NextResponse.json(
          {
            error: "Upgrade to Explorer to study course flashcards.",
            code: "MEMBERSHIP_REQUIRED",
            upgradeRequiredTier: access.upgradeRequiredTier,
          },
          { status: 403 },
        )
      }

      if (outcome === "known" && body.cardId != null) {
        const allCards = await fetchFlashcardCardsForDeck(deckId)
        const sortedIds = allCards.map((c) => c.id)
        if (isFlashcardLockedForTier(Number(body.cardId), sortedIds, tier, courseSettings.studyPolicy)) {
          return NextResponse.json(
            {
              error: "This card requires a higher membership tier.",
              code: "CARD_LOCKED",
              upgradeRequiredTier: tier === "Explorer" ? "Trailblazer" : "Explorer",
            },
            { status: 403 },
          )
        }

        const dailyCap = dailyCardCapForTier(tier, courseSettings.studyPolicy)
        if (dailyCap >= 0) {
          const todayStart = new Date()
          todayStart.setHours(0, 0, 0, 0)
          const dailyRow = await sql`
            SELECT COUNT(*)::int AS c
            FROM flashcard_study_events e
            JOIN flashcard_decks d ON d.id = e.deck_id
            WHERE e.student_id = ${auth.studentDbId}
              AND e.outcome = 'known'
              AND e.completed_at >= ${todayStart.toISOString()}::timestamptz
              AND d.deck_kind = 'course'
          `
          const dailyCount = Number(dailyRow[0]?.c) || 0
          if (dailyCount >= dailyCap) {
            return NextResponse.json(
              {
                error: `Daily course flashcard limit reached (${dailyCap}).`,
                code: "DAILY_CAP",
              },
              { status: 403 },
            )
          }
        }
      }
    }

    const sessionCode = ctx.session ?? resolveStudentSection() ?? "ALL"
    const result = await recordFlashcardStudyEvent({
      studentDbId: auth.studentDbId,
      sessionCode,
      deckId,
      cardId: body.cardId != null ? Number(body.cardId) : undefined,
      outcome,
      sessionId,
      streak: Number(body.streak) || 0,
      bonusType:
        body.bonusType === "timed" || body.bonusType === "boss" ? body.bonusType : undefined,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[student/flashcards/decks/[deckId]/study POST]", error)
    return NextResponse.json({ error: "Failed to record study event" }, { status: 500 })
  }
}
