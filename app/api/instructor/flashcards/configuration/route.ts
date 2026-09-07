import { type NextRequest, NextResponse } from "next/server"
import { requireInstructorCourse } from "@/lib/instructor-course-scope"
import { fetchFlashcardConfiguration } from "@/lib/instructor-flashcard-topics"
import { upsertFlashcardCourseSettings } from "@/lib/flashcard-course-settings"
import { clampFlashcardBatchSize } from "@/lib/flashcard-batch-study"
import {
  clampFlashcardDailyGoal,
  clampFlashcardTimedModeSeconds,
} from "@/lib/flashcard-study-policy"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const config = await fetchFlashcardConfiguration(scope.course.id)

    return NextResponse.json({
      ...config,
      courseCode: scope.course.course_code,
    })
  } catch (error) {
    console.error("[instructor/flashcards/configuration GET]", error)
    return NextResponse.json({ error: "Failed to load flashcard configuration" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireInstructorCourse(request)
    if (!scope.ok) return scope.response

    const body = (await request.json()) as {
      requireMcqValidation?: boolean
      cardsBeforeQuiz?: number
      dailyGoal?: number
      timedModeSeconds?: number
      studyPolicy?: Record<string, unknown>
    }

    const hasPatch =
      body.requireMcqValidation !== undefined ||
      body.cardsBeforeQuiz !== undefined ||
      body.dailyGoal !== undefined ||
      body.timedModeSeconds !== undefined ||
      body.studyPolicy !== undefined

    if (!hasPatch) {
      return NextResponse.json(
        {
          error:
            "requireMcqValidation, cardsBeforeQuiz, dailyGoal, timedModeSeconds, or studyPolicy required.",
        },
        { status: 400 },
      )
    }

    const settings = await upsertFlashcardCourseSettings(scope.course.id, {
      ...(body.requireMcqValidation !== undefined
        ? { requireMcqValidation: Boolean(body.requireMcqValidation) }
        : {}),
      ...(body.cardsBeforeQuiz !== undefined
        ? { cardsBeforeQuiz: clampFlashcardBatchSize(body.cardsBeforeQuiz) }
        : {}),
      ...(body.dailyGoal !== undefined ? { dailyGoal: clampFlashcardDailyGoal(body.dailyGoal) } : {}),
      ...(body.timedModeSeconds !== undefined
        ? { timedModeSeconds: clampFlashcardTimedModeSeconds(body.timedModeSeconds) }
        : {}),
      ...(body.studyPolicy !== undefined
        ? { studyPolicy: body.studyPolicy as Partial<import("@/lib/flashcard-study-policy").FlashcardStudyPolicy> }
        : {}),
    })

    return NextResponse.json({
      requireMcqValidation: settings.requireMcqValidation,
      cardsBeforeQuiz: settings.cardsBeforeQuiz,
      dailyGoal: settings.dailyGoal,
      timedModeSeconds: settings.timedModeSeconds,
      studyPolicy: settings.studyPolicy,
    })
  } catch (error) {
    console.error("[instructor/flashcards/configuration PATCH]", error)
    return NextResponse.json({ error: "Failed to update flashcard settings." }, { status: 500 })
  }
}
