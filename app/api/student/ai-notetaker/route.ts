import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getEffectiveMembershipTier } from "@/lib/membership"
import { canAccessAiNotetaker, getAiNotetakerLimitsForTier } from "@/lib/ai-notetaker-limits"
import { makeNotePublicSlug } from "@/lib/ai-notetaker-slug"
import { notetakerSlugColumnExists } from "@/lib/ai-notetaker-slug-column"
import { isDefaultNotetakerTitle } from "@/lib/ai-notetaker-auto-title"
import { requireAiNotetakerStudent } from "@/lib/ai-notetaker-request-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAiNotetakerStudent(request)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const { searchParams } = new URL(request.url)
    const q = (searchParams.get("q") || "").trim()
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1), 100)
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0)

    const [tier, hasSlug] = await Promise.all([
      getEffectiveMembershipTier(studentId),
      notetakerSlugColumnExists(),
    ])
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

    const usagePromise = sql`
      SELECT
        COUNT(*)::int AS notes_this_month,
        COALESCE(SUM(duration_seconds), 0)::bigint AS seconds_this_month
      FROM student_ai_notetaker_notes
      WHERE student_id = ${studentId}
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
    `

    let notesPromise
    if (q) {
      const pattern = `%${q.replace(/%/g, "\\%")}%`
      notesPromise = hasSlug
        ? sql`
            SELECT id, slug, title, course_name, lecture_date, processing_status, duration_seconds, created_at, updated_at
            FROM student_ai_notetaker_notes
            WHERE student_id = ${studentId}
              AND (
                title ILIKE ${pattern}
                OR COALESCE(course_name, '') ILIKE ${pattern}
                OR COALESCE(transcript, '') ILIKE ${pattern}
                OR COALESCE(summary, '') ILIKE ${pattern}
              )
            ORDER BY created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `
        : sql`
            SELECT id, title, course_name, lecture_date, processing_status, duration_seconds, created_at, updated_at
            FROM student_ai_notetaker_notes
            WHERE student_id = ${studentId}
              AND (
                title ILIKE ${pattern}
                OR COALESCE(course_name, '') ILIKE ${pattern}
                OR COALESCE(transcript, '') ILIKE ${pattern}
                OR COALESCE(summary, '') ILIKE ${pattern}
              )
            ORDER BY created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `
    } else {
      notesPromise = hasSlug
        ? sql`
            SELECT id, slug, title, course_name, lecture_date, processing_status, duration_seconds, created_at, updated_at
            FROM student_ai_notetaker_notes
            WHERE student_id = ${studentId}
            ORDER BY created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `
        : sql`
            SELECT id, title, course_name, lecture_date, processing_status, duration_seconds, created_at, updated_at
            FROM student_ai_notetaker_notes
            WHERE student_id = ${studentId}
            ORDER BY created_at DESC
            LIMIT ${limit}
            OFFSET ${offset}
          `
    }

    const [usageRows, notes] = await Promise.all([usagePromise, notesPromise])
    const usage = usageRows[0] as { notes_this_month: number; seconds_this_month: bigint }

    const notesWithSlug = (notes as Record<string, unknown>[]).map((n) => ({
      ...n,
      slug:
        (n.slug as string | undefined) ??
        makeNotePublicSlug(String(n.title ?? "Untitled lecture"), Number(n.id)),
    }))

    const minutesUsed = Number(usage.seconds_this_month || 0) / 60

    return NextResponse.json({
      notes: notesWithSlug,
      pagination: { limit, offset, count: notesWithSlug.length },
      limits: {
        tier,
        maxNoteDurationMinutes: limits.maxNoteDurationMinutes,
        transcriptionMinutes: limits.transcriptionMinutesMonthly,
        maxNotesPerMonth: limits.maxNotesPerMonth,
        chatEnabled: limits.chatEnabled,
        maxChatMessagesPerMonth: limits.maxChatMessagesPerMonth,
      },
      usage: {
        notesThisMonth: usage.notes_this_month,
        transcriptionMinutesUsed: Math.round(minutesUsed * 10) / 10,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to load notes"
    console.error("[ai-notetaker] GET list", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const auth = await requireAiNotetakerStudent(request, body.studentDatabaseId)
    if (!auth.ok) return auth.response
    const studentId = auth.studentDbId

    const rawTitle = String(body.title ?? "").trim().slice(0, 200)
    const insertTitle = rawTitle || "Untitled lecture"
    const course_name = body.course_name != null ? String(body.course_name).trim().slice(0, 200) : null
    const lecture_date = body.lecture_date != null && String(body.lecture_date).trim() ? String(body.lecture_date).trim() : null

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
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count
      FROM student_ai_notetaker_notes
      WHERE student_id = ${studentId}
        AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
    `
    if (Number(count) >= limits.maxNotesPerMonth) {
      return NextResponse.json(
        { error: `Monthly note limit reached (${limits.maxNotesPerMonth}).` },
        { status: 403 },
      )
    }

    const hasSlug = await notetakerSlugColumnExists()
    /** NOT NULL slug: insert a unique placeholder, then set canonical slug from id (avoids NULL between INSERT and UPDATE). */
    const pendingSlug = `pending-${crypto.randomUUID()}`
    const inserted = hasSlug
      ? await sql`
          INSERT INTO student_ai_notetaker_notes (
            student_id, title, course_name, lecture_date, processing_status, slug
          )
          VALUES (${studentId}, ${insertTitle}, ${course_name}, ${lecture_date}, 'draft', ${pendingSlug})
          RETURNING id, title, course_name, lecture_date, processing_status, created_at
        `
      : await sql`
          INSERT INTO student_ai_notetaker_notes (student_id, title, course_name, lecture_date, processing_status)
          VALUES (${studentId}, ${insertTitle}, ${course_name}, ${lecture_date}, 'draft')
          RETURNING id, title, course_name, lecture_date, processing_status, created_at
        `
    const insertedRows = Array.isArray(inserted) ? inserted : []
    const row = insertedRows[0] as { id: number; title: string } | undefined
    if (!row) {
      return NextResponse.json({ error: "Failed to create note" }, { status: 500 })
    }
    const finalTitle =
      !rawTitle || rawTitle === "Untitled lecture" || isDefaultNotetakerTitle(rawTitle)
        ? `New note ${row.id}`
        : rawTitle
    const slug = makeNotePublicSlug(finalTitle, row.id)
    if (hasSlug) {
      await sql`
        UPDATE student_ai_notetaker_notes
        SET title = ${finalTitle}, slug = ${slug}, updated_at = NOW()
        WHERE id = ${row.id} AND student_id = ${studentId}
      `
    } else {
      await sql`
        UPDATE student_ai_notetaker_notes
        SET title = ${finalTitle}, updated_at = NOW()
        WHERE id = ${row.id} AND student_id = ${studentId}
      `
    }
    const [full] = await sql`
      SELECT * FROM student_ai_notetaker_notes WHERE id = ${row.id} AND student_id = ${studentId} LIMIT 1
    `
    const noteRow = full as Record<string, unknown>
    return NextResponse.json({
      note: { ...noteRow, slug: (noteRow.slug as string | undefined) ?? slug },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create note"
    console.error("[ai-notetaker] POST", e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
