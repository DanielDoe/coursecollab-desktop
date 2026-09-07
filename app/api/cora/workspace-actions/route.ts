import { type NextRequest, NextResponse } from "next/server"
import { requireCallerStudentDbId } from "@/lib/student-api-auth"
import type { CoraWorkspaceActionMessage } from "@/lib/cora/workspace-actions"
import {
  createFlashcardsFromTopic,
  createPracticeQuiz,
  createStudyNoteFromTopic,
  exportChatToDigitalNote,
  searchPlatform,
} from "@/lib/cora/run-workspace-action"
import { automateStudyPlanFromChat } from "@/lib/cora/automate-study-plan"
import { isCoraWriteWorkspaceAction } from "@/lib/cora/read-only-agent"

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Body = {
  action:
    | "export_note"
    | "create_flashcards"
    | "create_note"
    | "search_platform"
    | "create_practice_quiz"
    | "automate_study_plan"
  messages?: CoraWorkspaceActionMessage[]
  topic?: string
  title?: string
  query?: string
  count?: number
  difficulty?: string
  courseId?: number | null
  reminderMinutes?: number
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCallerStudentDbId(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as Body & { confirmed?: boolean }
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (isCoraWriteWorkspaceAction(body.action) && body.confirmed !== true) {
      return NextResponse.json(
        {
          ok: false,
          error: "confirmation_required",
          message: "This action requires explicit confirmation from the app UI.",
        },
        { status: 400 },
      )
    }

    switch (body.action) {
      case "export_note": {
        if (messages.length === 0) {
          return NextResponse.json({ error: "No chat messages to export" }, { status: 400 })
        }
        const result = await exportChatToDigitalNote(auth.studentDbId, messages, body.title)
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: `Saved **${result.title}** to My Notes (${messages.length} turns exported).`,
          ...result,
        })
      }
      case "create_flashcards": {
        const topic = String(body.topic ?? "").trim()
        if (!topic) {
          return NextResponse.json({ error: "Topic is required for flashcards" }, { status: 400 })
        }
        const result = await createFlashcardsFromTopic(auth.studentDbId, topic, messages)
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: `Created flashcard deck **${result.title}** with ${result.cardCount} cards.`,
          ...result,
        })
      }
      case "create_note": {
        const topic = String(body.topic ?? "").trim()
        if (!topic) {
          return NextResponse.json({ error: "Topic is required for notes" }, { status: 400 })
        }
        const result = await createStudyNoteFromTopic(
          auth.studentDbId,
          topic,
          messages,
          body.title,
        )
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: `Created study note **${result.title}** in My Notes.`,
          ...result,
        })
      }
      case "search_platform": {
        const query = String(body.query ?? "").trim()
        if (!query) {
          return NextResponse.json({ error: "Search query is required" }, { status: 400 })
        }
        const result = await searchPlatform(auth.studentDbId, query)
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: result.message,
          results: result.results,
        })
      }
      case "create_practice_quiz": {
        const topic = String(body.topic ?? "").trim()
        if (!topic) {
          return NextResponse.json({ error: "Topic is required for practice quiz" }, { status: 400 })
        }
        const result = await createPracticeQuiz(auth.studentDbId, topic, {
          count: body.count,
          difficulty: body.difficulty,
          courseId: body.courseId,
        })
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: `Created a **${result.questionCount}-question** practice quiz on **${result.topic}**.`,
          ...result,
        })
      }
      case "automate_study_plan": {
        if (messages.length === 0) {
          return NextResponse.json({ error: "No study plan messages to automate" }, { status: 400 })
        }
        const result = await automateStudyPlanFromChat(auth.studentDbId, messages, {
          title: body.title,
          reminderMinutes:
            typeof body.reminderMinutes === "number" ? body.reminderMinutes : undefined,
        })
        return NextResponse.json({
          ok: true,
          action: body.action,
          message: result.message,
          ...result,
        })
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("[cora/workspace-actions]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed" },
      { status: 500 },
    )
  }
}
