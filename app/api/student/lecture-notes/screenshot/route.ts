import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { readLectureScreenshotIfExists } from "@/lib/lecture-screenshot-storage"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key")?.trim()
    const rosterId = request.nextUrl.searchParams.get("studentId")?.trim()
    if (!key || !rosterId) {
      return NextResponse.json({ error: "key and studentId required" }, { status: 400 })
    }

    if (key.includes("..") || key.startsWith("/")) {
      return NextResponse.json({ error: "Invalid key" }, { status: 400 })
    }

    const studentRows = await sql`
      SELECT id FROM students WHERE student_id = ${rosterId} LIMIT 1
    `
    if (!studentRows.length) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const studentDbId = Number((studentRows[0] as { id: number }).id)

    const owned = await sql`
      SELECT 1 FROM lecture_notes
      WHERE student_id = ${studentDbId} AND screenshot_storage_key = ${key}
      LIMIT 1
    `
    if (!owned.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const buffer = await readLectureScreenshotIfExists(key)
    if (!buffer) {
      return NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("[lecture-notes screenshot]", error)
    return NextResponse.json({ error: "Failed to load screenshot" }, { status: 500 })
  }
}
