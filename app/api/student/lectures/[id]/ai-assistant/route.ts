import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { sql } from "@/lib/db"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { saveLectureScreenshotBase64 } from "@/lib/lecture-screenshot-storage"
import {
  buildLectureAiSystemPrompt,
  buildUserPromptForAction,
  currentDayYmd,
  LECTURE_AI_DAILY_LIMIT,
  type LectureAiAction,
} from "@/lib/lecture-ai-assistant-prompt"
import { createWithFallback } from "@/lib/openai-with-fallback"

export const dynamic = "force-dynamic"
export const maxDuration = 45

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

const VALID_ACTIONS = new Set<LectureAiAction>([
  "explain_slide",
  "summarize_slide",
  "explain_selection",
  "screenshot_region",
  "custom",
])

type HistoryMessage = { role: "user" | "assistant"; content: string }

function sanitizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (m): m is HistoryMessage =>
        m != null &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
    .slice(-12)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const rosterId = String(body.studentId || body.student_id || "").trim()
    const question = String(body.question || "").trim()
    const action = (VALID_ACTIONS.has(body.action) ? body.action : "custom") as LectureAiAction
    const slideNumber = Math.max(1, Number.parseInt(String(body.slideNumber ?? 1), 10) || 1)
    const slideText = body.slideText ? String(body.slideText).slice(0, 12_000) : null
    const selectedText = body.selectedText ? String(body.selectedText).slice(0, 4_000) : null
    const screenshotDataUrl = body.screenshotBase64 ? String(body.screenshotBase64) : null
    const lectureTitle = body.lectureTitle ? String(body.lectureTitle).slice(0, 500) : "Lecture"
    const threadId = body.threadId ? String(body.threadId).slice(0, 64) : null
    const history = sanitizeHistory(body.history)

    const auth = await requireStudentLectureCaller(request, rosterId || null)
    if (!auth.ok) return auth.response

    if (action === "custom" && !question) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 })
    }

    const allowed = await isLectureAccessibleToStudent(auth.sessionRow.student_id, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const studentDbId = auth.studentDbId

    if (!openai) {
      return NextResponse.json({
        response:
          "AI Slide Assistant is not configured yet. Please ask your instructor or use lecture comments.",
        isConfigured: false,
      })
    }

    const day = currentDayYmd()
    const usageRows = await sql`
      SELECT message_count FROM lecture_ai_slide_usage
      WHERE student_id = ${studentDbId} AND day_ymd = ${day}
      LIMIT 1
    `
    const prev = usageRows.length ? Number((usageRows[0] as { message_count: number }).message_count) : 0
    if (prev >= LECTURE_AI_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${LECTURE_AI_DAILY_LIMIT} questions). Try again tomorrow.`,
          code: "RATE_LIMIT",
        },
        { status: 429 },
      )
    }

    const userPrompt = buildUserPromptForAction(action, question, {
      slideNumber,
      slideText,
      selectedText,
      hasScreenshot: Boolean(screenshotDataUrl?.startsWith("data:image/")),
    })

    const systemPrompt = buildLectureAiSystemPrompt(lectureTitle)
    const priorMessages: ChatCompletionMessageParam[] = history.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    let responseText: string
    const hasImage = screenshotDataUrl?.startsWith("data:image/")

    if (hasImage) {
      const visionMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...priorMessages,
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: screenshotDataUrl!, detail: "high" } },
          ],
        },
      ]
      const vision = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: visionMessages,
        max_tokens: 700,
        temperature: 0.4,
      })
      responseText = vision.choices[0]?.message?.content?.trim() || "I couldn't analyze the screenshot."
    } else {
      const textMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...priorMessages,
        { role: "user", content: userPrompt },
      ]
      const { content } = await createWithFallback(openai, {
        model: process.env.OPENAI_DEFAULT_MODEL,
        messages: textMessages,
        temperature: 0.5,
        max_tokens: 700,
      })
      responseText = content.trim()
    }

    let screenshotKey: string | null = null
    if (hasImage) {
      try {
        screenshotKey = await saveLectureScreenshotBase64(studentDbId, lectureId, screenshotDataUrl!)
      } catch (e) {
        console.warn("[AI Slide Assistant] screenshot save failed:", e)
      }
    }

    const questionToStore =
      question ||
      (action === "explain_slide"
        ? "Explain this slide"
        : action === "summarize_slide"
          ? "Summarize this slide"
          : action === "explain_selection"
            ? selectedText
              ? `Explain: ${selectedText.slice(0, 200)}`
              : "Explain selected text"
            : action === "screenshot_region"
              ? "Explain captured region"
              : "Question")

    let noteId: number | null = null
    try {
      const inserted = await sql`
        INSERT INTO lecture_notes (
          student_id, lecture_id, slide_number, question, ai_response,
          screenshot_storage_key, selected_text, slide_text, action_type, thread_id
        ) VALUES (
          ${studentDbId}, ${lectureId}, ${slideNumber}, ${questionToStore}, ${responseText},
          ${screenshotKey}, ${selectedText}, ${slideText}, ${action}, ${threadId}
        )
        RETURNING id
      `
      noteId = Number((inserted[0] as { id: number }).id)
    } catch (dbErr: unknown) {
      const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
      if (msg.includes("does not exist") || msg.includes("thread_id")) {
        try {
          const inserted = await sql`
            INSERT INTO lecture_notes (
              student_id, lecture_id, slide_number, question, ai_response,
              screenshot_storage_key, selected_text, slide_text, action_type
            ) VALUES (
              ${studentDbId}, ${lectureId}, ${slideNumber}, ${questionToStore}, ${responseText},
              ${screenshotKey}, ${selectedText}, ${slideText}, ${action}
            )
            RETURNING id
          `
          noteId = Number((inserted[0] as { id: number }).id)
        } catch (fallbackErr) {
          console.error("[AI Slide Assistant] save note failed:", fallbackErr)
        }
      } else {
        console.error("[AI Slide Assistant] save note failed:", dbErr)
      }
    }

    await sql`
      INSERT INTO lecture_ai_slide_usage (student_id, day_ymd, message_count)
      VALUES (${studentDbId}, ${day}, 1)
      ON CONFLICT (student_id, day_ymd)
      DO UPDATE SET message_count = lecture_ai_slide_usage.message_count + 1
    `

    return NextResponse.json({
      response: responseText,
      noteId,
      screenshotUrl: screenshotKey
        ? `/api/student/lecture-notes/screenshot?key=${encodeURIComponent(screenshotKey)}&studentId=${encodeURIComponent(rosterId)}`
        : null,
      isConfigured: true,
      remainingToday: Math.max(0, LECTURE_AI_DAILY_LIMIT - prev - 1),
    })
  } catch (error: unknown) {
    console.error("[AI Slide Assistant]", error)
    return NextResponse.json(
      { error: "Failed to get AI response. Please try again." },
      { status: 500 },
    )
  }
}
