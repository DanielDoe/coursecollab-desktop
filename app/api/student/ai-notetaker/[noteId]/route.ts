import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { canAccessAiNotetaker, getAiNotetakerLimitsForTier } from "@/lib/ai-notetaker-limits"
import { deleteNotetakerAudioIfExists } from "@/lib/ai-notetaker-storage"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"
import { resolveNotetakerNoteDatabaseId } from "@/lib/ai-notetaker-resolve-ref"
import { makeNotePublicSlug } from "@/lib/ai-notetaker-slug"
import { notetakerSlugColumnExists } from "@/lib/ai-notetaker-slug-column"

export const dynamic = "force-dynamic"

async function loadOwnedNote(noteId: number, studentId: number) {
  const rows = await sql`
    SELECT *
    FROM student_ai_notetaker_notes
    WHERE id = ${noteId} AND student_id = ${studentId}
    LIMIT 1
  `
  return rows[0] as Record<string, unknown> | undefined
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const auth = await requireAiNotetakerStudent(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId
    const { noteId: raw } = await params
    const noteId = await resolveNotetakerNoteDatabaseId(raw, studentId)
    if (noteId == null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const note = await loadOwnedNote(noteId, studentId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })
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
    const slugOut =
      (note.slug as string | undefined) ??
      makeNotePublicSlug(String(note.title ?? "Untitled lecture"), noteId)
    return NextResponse.json({
      note: { ...note, slug: slugOut },
      limits: {
        tier,
        maxNoteDurationMinutes: limits.maxNoteDurationMinutes,
        chatEnabled: limits.chatEnabled,
        transcriptionMinutes: limits.transcriptionMinutesMonthly,
        maxNotesPerMonth: limits.maxNotesPerMonth,
      },
    })
  } catch (e: unknown) {
    console.error("[ai-notetaker] GET one", e)
    return NextResponse.json({ error: "Failed to load note" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const auth = await requireAiNotetakerStudent(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId
    const { noteId: raw } = await params
    const noteId = await resolveNotetakerNoteDatabaseId(raw, studentId)
    if (noteId == null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const existing = await loadOwnedNote(noteId, studentId)
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

    const body = await request.json().catch(() => ({}))
    const title = body.title != null ? String(body.title).trim().slice(0, 200) : existing.title
    const course_name =
      body.course_name !== undefined
        ? body.course_name === null
          ? null
          : String(body.course_name).trim().slice(0, 200)
        : existing.course_name
    const lecture_date =
      body.lecture_date !== undefined
        ? body.lecture_date === null || body.lecture_date === ""
          ? null
          : String(body.lecture_date).trim()
        : existing.lecture_date

    const newSlug = makeNotePublicSlug(String(title), noteId)
    const hasSlug = await notetakerSlugColumnExists()
    const updated = hasSlug
      ? await sql`
          UPDATE student_ai_notetaker_notes
          SET title = ${title},
              slug = ${newSlug},
              course_name = ${course_name},
              lecture_date = ${lecture_date},
              updated_at = NOW()
          WHERE id = ${noteId} AND student_id = ${studentId}
          RETURNING *
        `
      : await sql`
          UPDATE student_ai_notetaker_notes
          SET title = ${title},
              course_name = ${course_name},
              lecture_date = ${lecture_date},
              updated_at = NOW()
          WHERE id = ${noteId} AND student_id = ${studentId}
          RETURNING *
        `
    const row = updated[0] as Record<string, unknown>
    return NextResponse.json({
      note: { ...row, slug: (row.slug as string | undefined) ?? newSlug },
    })
  } catch (e: unknown) {
    console.error("[ai-notetaker] PATCH", e)
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const auth = await requireAiNotetakerStudent(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId
    const { noteId: raw } = await params
    const noteId = await resolveNotetakerNoteDatabaseId(raw, studentId)
    if (noteId == null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    const existing = await loadOwnedNote(noteId, studentId)
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

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

    const key = existing.audio_storage_key as string | null
    await deleteNotetakerAudioIfExists(key)
    await sql`DELETE FROM student_ai_notetaker_notes WHERE id = ${noteId} AND student_id = ${studentId}`
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    console.error("[ai-notetaker] DELETE", e)
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 })
  }
}
