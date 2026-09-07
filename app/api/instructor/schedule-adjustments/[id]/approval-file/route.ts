import { type NextRequest, NextResponse } from "next/server"
import { get } from "@vercel/blob"
import { requireCoursePermission } from "@/lib/course-permission-guard"
import { getRequestById } from "@/lib/schedule-adjustment/workflow-service"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

async function loadStoredUrl(requestId: number): Promise<string | null> {
  const rows = await sql`
    SELECT attachment_url
    FROM schedule_approval_records
    WHERE request_id = ${requestId}
      AND attachment_url IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `
  const url = (rows[0] as { attachment_url?: string } | undefined)?.attachment_url
  return url?.trim() || null
}

async function readBlob(target: string): Promise<Buffer | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (!token) return null
  try {
    if (target.startsWith("https://") || target.startsWith("http://")) {
      const res = await fetch(target, { cache: "no-store" })
      if (!res.ok) return null
      return Buffer.from(await res.arrayBuffer())
    }
    const result = await get(target, { access: "public", token, useCache: false })
    if (!result?.stream) return null
    return Buffer.from(await new Response(result.stream).arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const ctx = await requireCoursePermission(request, [
    "manage_course_settings",
    "view_course_content",
    "view_analytics",
  ])
  if (!ctx.ok) return ctx.response

  const requestId = Number((await context.params).id)
  const existing = await getRequestById(requestId)
  if (!existing || existing.course_id !== ctx.course.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const stored = await loadStoredUrl(requestId)
  if (!stored) return NextResponse.json({ error: "No approval file" }, { status: 404 })

  const bytes = await readBlob(stored)
  if (!bytes?.length) return NextResponse.json({ error: "File unavailable" }, { status: 404 })

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="schedule-approval-${requestId}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
