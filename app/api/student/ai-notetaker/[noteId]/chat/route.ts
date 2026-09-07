import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { canAccessAiNotetaker, getAiNotetakerLimitsForTier } from "@/lib/ai-notetaker-limits"
import { resolveNotetakerNoteDatabaseId } from "@/lib/ai-notetaker-resolve-ref"
import OpenAI from "openai"
import { createForFeature } from "@/lib/resolve-feature-ai-model"
import { sanitizeMessagesForExternalAi, logCoraExternalAiCall } from "@/lib/cora/privacy/ai-data-minimization"

export const dynamic = "force-dynamic"

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null

function currentMonthYm(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireAiNotetakerStudent(request, body.studentDatabaseId)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId
    const { noteId: raw } = await params
    const noteId = await resolveNotetakerNoteDatabaseId(raw, studentId)
    if (noteId == null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const message = String(body.message || "").trim()
    if (!message || message.length > 4_000) {
      return NextResponse.json({ error: "Message required (max 4000 chars)" }, { status: 400 })
    }

    const tier = await getEffectiveMembershipTier(studentId)
    if (!canAccessAiNotetaker(tier)) {
      return NextResponse.json(
        {
          error: "AI Notetaker is available for Explorer and Trailblazer members.",
          code: "NOTETAKER_TIER",
        },
        { status: 403 },
      )
    }
    const limits = getAiNotetakerLimitsForTier(tier)!
    if (!limits.chatEnabled) {
      return NextResponse.json(
        {
          error: "AI Chat with notes is available on Trailblazer. Upgrade to ask questions about your transcripts.",
          upgrade: true,
        },
        { status: 403 },
      )
    }

    if (!openai) {
      return NextResponse.json({ error: "AI is not configured." }, { status: 503 })
    }

    const rows = await sql`
      SELECT id, title, transcript, processing_status
      FROM student_ai_notetaker_notes
      WHERE id = ${noteId} AND student_id = ${studentId}
      LIMIT 1
    `
    const note = rows[0] as { id: number; title: string; transcript: string | null; processing_status: string } | undefined
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (note.processing_status !== "completed" || !note.transcript?.trim()) {
      return NextResponse.json({ error: "Transcript not ready yet." }, { status: 400 })
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

    const transcriptBlock =
      note.transcript.length > 60_000
        ? `${note.transcript.slice(0, 60_000)}\n\n[Transcript truncated for chat context.]`
        : note.transcript

    const messages = sanitizeMessagesForExternalAi([
      {
        role: "system",
        content:
          "You are a study assistant. Answer ONLY using the lecture transcript provided. " +
          "If the answer is not in the transcript, say clearly that you could not find it in this lecture's notes. " +
          "Do not invent facts. Be concise.",
      },
      {
        role: "user",
        content: `Lecture title: ${note.title}\n\nTranscript:\n${transcriptBlock}\n\nStudent question: ${message}`,
      },
    ])
    logCoraExternalAiCall({
      feature: "ai-notetaker-chat",
      messageCount: messages.length,
      promptChars: messages.reduce((n, m) => n + m.content.length, 0),
    })

    const { content } = await createForFeature(openai, "tutor", {
      usageContext: {
        actor: { userId: studentId, userRole: "student", membershipTier: tier },
        feature: "NOTETAKER",
        module: "ai-notetaker-chat",
      },
      messages,
      temperature: 0.3,
      max_tokens: 900,
    })

    await sql`
      INSERT INTO student_ai_notetaker_chat_usage (student_id, month_ym, message_count)
      VALUES (${studentId}, ${ym}, 1)
      ON CONFLICT (student_id, month_ym)
      DO UPDATE SET message_count = student_ai_notetaker_chat_usage.message_count + 1
    `

    return NextResponse.json({ reply: content.trim() })
  } catch (e: unknown) {
    console.error("[ai-notetaker] chat", e)
    return NextResponse.json({ error: "Chat failed" }, { status: 500 })
  }
}
