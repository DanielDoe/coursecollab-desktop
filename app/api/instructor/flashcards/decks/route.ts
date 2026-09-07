import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { isElegSharedLectureCourseCode } from "@/lib/instructor-default-courses"
import { resolveModuleContentSessionFilter } from "@/lib/module-content-session-scope"
import {
  ensureFlashcardSchema,
  fetchFlashcardCardsForDeck,
  mapFlashcardCard,
  mapFlashcardDeck,
  parseFlashcardCustomDistractors,
} from "@/lib/flashcards"
import { fetchFlashcardCourseSettings } from "@/lib/flashcard-course-settings"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const sessionFilter = await resolveModuleContentSessionFilter(
      request,
      request.nextUrl.searchParams.get("session"),
    )

    const elegProgramming = isElegSharedLectureCourseCode(scope.course.course_code)

    const rows =
      sessionFilter.mode === "section"
        ? await sql`
            SELECT *
            FROM flashcard_decks
            WHERE deck_kind = 'course'
              AND course_id = ${scope.course.id}
              AND deleted_at IS NULL
              AND (session IS NULL OR session = ANY(${sessionFilter.sessionVariants}))
              AND (
                ${elegProgramming} = false
                OR (
                  COALESCE(topic, '') NOT ILIKE '%AC Analysis%'
                  AND title NOT ILIKE '%AC Analysis%'
                )
              )
            ORDER BY updated_at DESC
          `
        : await sql`
            SELECT *
            FROM flashcard_decks
            WHERE deck_kind = 'course'
              AND course_id = ${scope.course.id}
              AND deleted_at IS NULL
              AND (
                ${elegProgramming} = false
                OR (
                  COALESCE(topic, '') NOT ILIKE '%AC Analysis%'
                  AND title NOT ILIKE '%AC Analysis%'
                )
              )
            ORDER BY updated_at DESC
          `

    return NextResponse.json({
      decks: (rows as never[]).map((d) => mapFlashcardDeck(d, true)),
      courseCode: scope.course.course_code,
      session: sessionFilter.mode === "section" ? sessionFilter.sessionCode : "ALL",
    })
  } catch (error) {
    console.error("[instructor/flashcards/decks GET]", error)
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    await ensureFlashcardSchema()

    const body = (await request.json()) as {
      title?: string
      description?: string
      topic?: string
      session?: string | null
      showInPracticeHub?: boolean
      isPublished?: boolean
    }

    const title = String(body.title ?? "Untitled deck").trim() || "Untitled deck"
    const description = String(body.description ?? "")
    const topic = body.topic != null ? String(body.topic).trim() || null : null
    let sessionRaw = body.session != null ? String(body.session).trim() : ""
    if (!sessionRaw) {
      const sessionFilter = await resolveModuleContentSessionFilter(request, null)
      if (sessionFilter.mode === "section") {
        sessionRaw = sessionFilter.sessionCode
      }
    }
    const session = sessionRaw && sessionRaw !== "ALL" ? sessionRaw : null
    const showInPracticeHub = Boolean(body.showInPracticeHub)
    const isPublished = body.isPublished !== false
    const { requireMcqValidation, cardsBeforeQuiz } = await fetchFlashcardCourseSettings(scope.course.id)

    const rows = await sql`
      INSERT INTO flashcard_decks (
        title, description, deck_kind, course_id, session, instructor_id, topic,
        show_in_practice_hub, is_published, require_mcq_validation, cards_before_quiz
      )
      VALUES (
        ${title}, ${description}, 'course', ${scope.course.id}, ${session},
        ${scope.instructorId}, ${topic}, ${showInPracticeHub}, ${isPublished}, ${requireMcqValidation}, ${cardsBeforeQuiz}
      )
      RETURNING *
    `

    return NextResponse.json({ deck: mapFlashcardDeck(rows[0] as never, true) })
  } catch (error) {
    console.error("[instructor/flashcards/decks POST]", error)
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
