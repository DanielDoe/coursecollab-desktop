import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { canAccessAiNotetaker, getAiNotetakerLimitsForTier } from "@/lib/ai-notetaker-limits"
import { saveNotetakerAudioBuffer, readNotetakerAudioIfExists, deleteNotetakerAudioIfExists } from "@/lib/ai-notetaker-storage"
import { transcribeAudioFile, summarizeTranscript, keyPointsToSummaryText } from "@/lib/ai-notetaker-process"
import { resolveNotetakerNoteDatabaseId } from "@/lib/ai-notetaker-resolve-ref"
import { makeNotePublicSlug } from "@/lib/ai-notetaker-slug"
import { notetakerSlugColumnExists } from "@/lib/ai-notetaker-slug-column"

export const dynamic = "force-dynamic"
export const maxDuration = 300

const MAX_UPLOAD_BYTES = 26 * 1024 * 1024

async function loadOwned(noteId: number, studentId: number) {
  const rows = await sql`
    SELECT * FROM student_ai_notetaker_notes
    WHERE id = ${noteId} AND student_id = ${studentId}
    LIMIT 1
  `
  return rows[0] as Record<string, unknown> | undefined
}

/** Secure audio playback for the owning student. */
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
    const note = await loadOwned(noteId, studentId)
    if (!note?.audio_storage_key) {
      return NextResponse.json({ error: "No audio" }, { status: 404 })
    }
    const tier = await getEffectiveMembershipTier(studentId)
    if (!canAccessAiNotetaker(tier)) {
      return NextResponse.json(
        { error: "AI Notetaker is available for Explorer and Trailblazer members.", code: "NOTETAKER_TIER" },
        { status: 403 },
      )
    }
    const buf = await readNotetakerAudioIfExists(String(note.audio_storage_key))
    if (!buf) return NextResponse.json({ error: "Audio missing" }, { status: 404 })
    const mime = (note.audio_mime as string) || "audio/webm"
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e: unknown) {
    console.error("[ai-notetaker] GET audio", e)
    return NextResponse.json({ error: "Failed to stream audio" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ noteId: string }> }) {
  try {
    const { noteId: raw } = await params

    const form = await request.formData()
    const sidRaw = form.get("studentDatabaseId")
    const auth = await requireAiNotetakerStudent(request, sidRaw)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const noteId = await resolveNotetakerNoteDatabaseId(raw, studentId)
    if (noteId == null) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const note = await loadOwned(noteId, studentId)
    if (!note) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const file = form.get("file")
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Audio file required" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max ~25 MB)" }, { status: 400 })
    }

    const durationSecondsRaw = form.get("durationSeconds")
    const durationParsed =
      durationSecondsRaw != null ? Math.max(0, parseInt(String(durationSecondsRaw), 10) || 0) : 0

    const tier = await getEffectiveMembershipTier(studentId)
    if (!canAccessAiNotetaker(tier)) {
      return NextResponse.json(
        { error: "AI Notetaker is available for Explorer and Trailblazer members.", code: "NOTETAKER_TIER" },
        { status: 403 },
      )
    }
    const limits = getAiNotetakerLimitsForTier(tier)!
    const maxSecPerNote = limits.maxNoteDurationMinutes * 60
    const sizeEstimateSec = Math.round((file.size / 50_000) * 60)

    const [{ seconds_this_month }] = await sql`
      SELECT COALESCE(SUM(duration_seconds), 0)::bigint AS seconds_this_month
      FROM student_ai_notetaker_notes
      WHERE student_id = ${studentId}
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
        AND id <> ${noteId}
    `
    const usedSec = Number(seconds_this_month || 0)
    const newSec = Math.max(durationParsed, sizeEstimateSec)
    if (newSec > maxSecPerNote + 0.5) {
      return NextResponse.json(
        {
          error: `This recording is longer than your plan allows (${limits.maxNoteDurationMinutes} minutes per note).`,
          code: "NOTETAKER_NOTE_DURATION",
          maxNoteDurationMinutes: limits.maxNoteDurationMinutes,
        },
        { status: 403 },
      )
    }
    const projectedMinutes = (usedSec + newSec) / 60
    if (projectedMinutes > limits.transcriptionMinutesMonthly + 0.01) {
      return NextResponse.json(
        {
          error: `Transcription limit for your plan is about ${limits.transcriptionMinutesMonthly} minutes this month.`,
        },
        { status: 403 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const mime = file.type || "audio/webm"
    const extFromName = (file as File).name?.split(".").pop()?.toLowerCase()
    const ext = extFromName && extFromName.length <= 8 ? extFromName : mime.includes("mp4") ? "m4a" : "webm"

    const displayTitleRaw = form.get("displayTitle")
    const displayTitle =
      displayTitleRaw != null && String(displayTitleRaw).trim()
        ? String(displayTitleRaw).trim().slice(0, 200)
        : null

    const oldKey = note.audio_storage_key as string | null
    if (oldKey) await deleteNotetakerAudioIfExists(oldKey)

    const storageKey = await saveNotetakerAudioBuffer(studentId, noteId, buf, ext)

    const hasSlug = await notetakerSlugColumnExists()
    if (displayTitle && hasSlug) {
      const newSlug = makeNotePublicSlug(displayTitle, noteId)
      await sql`
        UPDATE student_ai_notetaker_notes
        SET audio_storage_key = ${storageKey},
            audio_mime = ${mime},
            duration_seconds = ${newSec},
            title = ${displayTitle},
            slug = ${newSlug},
            processing_status = 'transcribing',
            failure_reason = NULL,
            transcript = NULL,
            summary = NULL,
            key_points = NULL,
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
    } else if (displayTitle) {
      await sql`
        UPDATE student_ai_notetaker_notes
        SET audio_storage_key = ${storageKey},
            audio_mime = ${mime},
            duration_seconds = ${newSec},
            title = ${displayTitle},
            processing_status = 'transcribing',
            failure_reason = NULL,
            transcript = NULL,
            summary = NULL,
            key_points = NULL,
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
    } else {
      await sql`
        UPDATE student_ai_notetaker_notes
        SET audio_storage_key = ${storageKey},
            audio_mime = ${mime},
            duration_seconds = ${newSec},
            processing_status = 'transcribing',
            failure_reason = NULL,
            transcript = NULL,
            summary = NULL,
            key_points = NULL,
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
    }

    try {
      const transcript = await transcribeAudioFile({ storageKey, mimeType: mime })
      await sql`
        UPDATE student_ai_notetaker_notes
        SET transcript = ${transcript},
            processing_status = 'summarizing',
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
      const keyPoints = await summarizeTranscript(transcript)
      const summaryText = keyPointsToSummaryText(keyPoints)
      await sql`
        UPDATE student_ai_notetaker_notes
        SET summary = ${summaryText},
            key_points = ${JSON.stringify(keyPoints)}::jsonb,
            processing_status = 'completed',
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
    } catch (procErr: unknown) {
      const msg = procErr instanceof Error ? procErr.message : "Processing failed"
      await sql`
        UPDATE student_ai_notetaker_notes
        SET processing_status = 'failed',
            failure_reason = ${msg.slice(0, 2000)},
            updated_at = NOW()
        WHERE id = ${noteId} AND student_id = ${studentId}
      `
      return NextResponse.json({ error: msg, noteId }, { status: 502 })
    }

    const [fresh] = await sql`
      SELECT * FROM student_ai_notetaker_notes WHERE id = ${noteId} AND student_id = ${studentId} LIMIT 1
    `
    const f = fresh as Record<string, unknown>
    return NextResponse.json({
      note: {
        ...f,
        slug:
          (f.slug as string | undefined) ??
          makeNotePublicSlug(String(f.title ?? "Untitled lecture"), noteId),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Upload failed"
    console.error("[ai-notetaker] POST audio", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
