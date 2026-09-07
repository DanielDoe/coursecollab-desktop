import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { canAccessAiNotetaker, getAiNotetakerLimitsForTier } from "@/lib/ai-notetaker-limits"
import OpenAI from "openai"
import { createForFeature } from "@/lib/resolve-feature-ai-model"

export const dynamic = "force-dynamic"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

function currentMonthYm(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * Chat against browser live captions while recording (approximate text).
 * Uses the same Trailblazer quota as note transcript chat.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireAiNotetakerStudent(request, body.studentDatabaseId)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const message = String(body.message || "").trim()
    const context = String(body.context || "").trim()
    if (!message || message.length > 4_000) {
      return NextResponse.json({ error: "Message required (max 4000 chars)" }, { status: 400 })
    }
    if (!context || context.length < 8) {
      return NextResponse.json(
        { error: "Need a bit of live caption text first—keep speaking for a moment, then try again." },
        { status: 400 },
      )
    }
    const contextBlock =
      context.length > 12_000 ? `${context.slice(0, 12_000)}\n\n[Live captions truncated for context.]` : context

    const tier = await getEffectiveMembershipTier(studentId)
    if (!canAccessAiNotetaker(tier)) {
      return NextResponse.json(
        { error: "AI Notetaker is available for Explorer and Trailblazer members.", code: "NOTETAKER_TIER" },
        { status: 403 },
      )
    }
    const limits = getAiNotetakerLimitsForTier(tier)!
    if (!limits.chatEnabled) {
      return NextResponse.json(
        {
          error: "AI chat during recording is a Trailblazer feature. Upgrade to ask questions about live captions.",
          upgrade: true,
        },
        { status: 403 },
      )
    }

    if (!openai) {
      return NextResponse.json({ error: "AI is not configured." }, { status: 503 })
    }

    const ym = currentMonthYm()
    const usageRows = await sql`
      SELECT message_count FROM student_ai_notetaker_chat_usage
      WHERE student_id = ${studentId} AND month_ym = ${ym}
      LIMIT 1
    `
    const prev = usageRows.length ? Number((usageRows[0] as { message_count: number }).message_count) : 0
    if (prev >= limits.maxChatMessagesPerMonth) {
      return NextResponse.json(
        { error: "Monthly AI chat message limit reached. Try again next month or contact support." },
        { status: 429 },
      )
    }

    const { content } = await createForFeature(openai, "tutor", {
      usageContext: {
        actor: { userId: studentId, userRole: "student", membershipTier: tier },
        feature: "NOTETAKER",
        module: "ai-notetaker-live-caption",
      },
      messages: [
        {
          role: "system",
          content:
            "You are a study assistant helping during a live lecture recording. " +
            "The student message is based on approximate browser live captions (may contain errors or gaps). " +
            "Answer ONLY using ideas clearly supported by that caption text. " +
            "If the captions do not contain enough to answer, say so briefly and suggest they continue recording or rephrase. " +
            "A full AI transcript will be available after they stop—do not claim the captions are the final transcript. " +
            "Be concise.",
        },
        {
          role: "user",
          content: `Live captions so far:\n${contextBlock}\n\nStudent question: ${message}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 700,
    })

    await sql`
      INSERT INTO student_ai_notetaker_chat_usage (student_id, month_ym, message_count)
      VALUES (${studentId}, ${ym}, 1)
      ON CONFLICT (student_id, month_ym)
      DO UPDATE SET message_count = student_ai_notetaker_chat_usage.message_count + 1
    `

    return NextResponse.json({ reply: content.trim() })
  } catch (e: unknown) {
    console.error("[ai-notetaker] live-caption-chat", e)
    return NextResponse.json({ error: "Chat failed" }, { status: 500 })
  }
}
