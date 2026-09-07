import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import { resolveStudentEnrollmentContext } from "@/lib/student-enrollment-context"
import { resolveStudentFlashcardListScope } from "@/lib/student-flashcard-list-scope"
import {
  ensureFlashcardSchema,
  fetchCourseFlashcardDecksForStudent,
  fetchStudentFlashcardDecks,
  mapFlashcardDeck,
  studentCanEditDeck,
} from "@/lib/flashcards"
import {
  defaultFlashcardCourseSettings,
  fetchFlashcardCourseSettings,
} from "@/lib/flashcard-course-settings"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { flashcardAccessForStudentClient } from "@/lib/flashcard-study-policy"

export const dynamic = "force-dynamic"

async function resolveStudentCourseContext(studentDbId: number) {
  return resolveStudentEnrollmentContext(studentDbId)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    await ensureFlashcardSchema()

    const { searchParams } = request.nextUrl
    const practiceHubOnly = searchParams.get("practiceHub") === "true"
    const ctx = await resolveStudentCourseContext(auth.studentDbId)
    const { courseId, session } = resolveStudentFlashcardListScope(ctx, {
      courseId: searchParams.get("courseId"),
      session: searchParams.get("session"),
    })

    const [courseDecks, myDecks] = await Promise.all([
      fetchCourseFlashcardDecksForStudent({ courseId, session, practiceHubOnly }),
      practiceHubOnly ? Promise.resolve([]) : fetchStudentFlashcardDecks(auth.studentDbId),
    ])

    const courseSettings =
      courseId != null ? await fetchFlashcardCourseSettings(courseId) : defaultFlashcardCourseSettings()
    const tier = await getEffectiveMembershipTier(auth.studentDbId)

    return NextResponse.json({
      courseDecks: courseDecks.map((d) => mapFlashcardDeck(d, false)),
      myDecks: myDecks.map((d) => mapFlashcardDeck(d, studentCanEditDeck(d, auth.studentDbId))),
      courseId,
      session,
      studySettings: {
        dailyGoal: courseSettings.dailyGoal,
        timedModeSeconds: courseSettings.timedModeSeconds,
        tierAccess: flashcardAccessForStudentClient(tier, courseSettings.studyPolicy),
      },
    })
  } catch (error) {
    console.error("[student/flashcards/decks GET]", error)
    return NextResponse.json({ error: "Failed to load flashcard decks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as {
      title?: string
      description?: string
      topic?: string
    }
    const { createStudentFlashcardDeck } = await import(
      "@/lib/cora/services/create-student-flashcard-deck"
    )
    const created = await createStudentFlashcardDeck({
      studentDbId: auth.studentDbId,
      title: String(body.title ?? "Untitled deck").trim() || "Untitled deck",
      description: String(body.description ?? ""),
      topic: body.topic != null ? String(body.topic).trim() || null : null,
    })

    return NextResponse.json({
      deck: created.deck,
    })
  } catch (error) {
    console.error("[student/flashcards/decks POST]", error)
    return NextResponse.json({ error: "Failed to create deck" }, { status: 500 })
  }
}
