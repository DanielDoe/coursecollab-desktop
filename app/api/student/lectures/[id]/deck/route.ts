import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import {
  fetchStoredAssetBytes,
  isRemoteStoredAssetUrl,
  resolveStoredAssetUrl,
} from "@/lib/resolve-stored-asset"
import { requireStudentLectureCaller } from "@/lib/require-student-lecture-auth"
import { isLectureAccessibleToStudent } from "@/lib/student-lecture-access"
import {
  resolveLectureStoredDeckUrl,
  verifyStudentLectureDeckToken,
} from "@/lib/lecture-deck-signed-url"

export const dynamic = "force-dynamic"

function filenameFor(url: string): string {
  try {
    const name = new URL(url).pathname.split("/").filter(Boolean).pop()
    if (name?.trim()) return name
  } catch {
    /* keep default */
  }
  return "lecture.pdf"
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const lectureId = Number.parseInt(id, 10)
    if (!Number.isFinite(lectureId)) {
      return NextResponse.json({ error: "Invalid lecture id" }, { status: 400 })
    }

    const claimed = request.nextUrl.searchParams.get("studentId")
    const auth = await requireStudentLectureCaller(request, claimed)
    let studentDbId: number | null = auth.ok ? auth.studentDbId : null
    let rosterId: string | null = auth.ok ? auth.sessionRow.student_id : null

    if (!auth.ok) {
      const exp = Number(request.nextUrl.searchParams.get("exp"))
      const sid = Number(request.nextUrl.searchParams.get("sid"))
      const sig = request.nextUrl.searchParams.get("sig")?.trim() ?? ""
      const tokenOk =
        Number.isFinite(sid) &&
        sig.length > 0 &&
        verifyStudentLectureDeckToken({ lectureId, studentDbId: sid, exp, sig })
      if (!tokenOk) return auth.response
      studentDbId = sid
      const roster = await sql`
        SELECT student_id FROM students WHERE id = ${sid} LIMIT 1
      `
      rosterId = roster.length ? String((roster[0] as { student_id: string }).student_id) : null
    }

    if (studentDbId == null || !rosterId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const allowed = await isLectureAccessibleToStudent(rosterId, lectureId)
    if (!allowed) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const rows = await sql`
      SELECT pdf_url, original_file_url, materials_url
      FROM lectures
      WHERE id = ${lectureId} AND deleted_at IS NULL
      LIMIT 1
    `
    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const stored = resolveLectureStoredDeckUrl(rows[0] as Record<string, unknown>)
    if (!stored) {
      return NextResponse.json({ error: "No slide deck" }, { status: 404 })
    }

    const resolved = await resolveStoredAssetUrl(stored)
    if (resolved && isRemoteStoredAssetUrl(resolved)) {
      // Proxying multi-MB PDFs through serverless exceeds Vercel response limits.
      // Auth is enforced above; redirect to the stored asset (blob/CDN) for inline viewing.
      return NextResponse.redirect(resolved, {
        status: 307,
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }

    const bytes = await fetchStoredAssetBytes(stored, request.nextUrl.origin)
    if (!bytes?.length) {
      return NextResponse.json({ error: "Deck unavailable" }, { status: 404 })
    }

    const filename = filenameFor(stored)
    const isPdf = filename.toLowerCase().endsWith(".pdf") || stored.toLowerCase().includes(".pdf")
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=60",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("[Student lecture deck]", error)
    const message = error instanceof Error ? error.message : "Failed to load deck"
    const status = message.includes("signing secret") ? 503 : 500
    return NextResponse.json({ error: "Failed to load deck", detail: message }, { status })
  }
}
