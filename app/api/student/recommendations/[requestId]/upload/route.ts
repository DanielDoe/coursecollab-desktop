import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { sqlRows } from "@/lib/sql-rows"
import { requireBoundStudentCaller } from "@/lib/student-api-auth"
import { savePublicUpload } from "@/lib/blob-or-local-public"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId: rid } = await context.params
    const requestId = parseInt(rid, 10)
    const formData = await request.formData()
    const rawStudent = String(formData.get("studentDatabaseId") ?? formData.get("studentId") ?? "").trim()
    const fileType = String(formData.get("fileType") ?? formData.get("file_type") ?? "")
    const file = formData.get("file") as File | null

    if (!file || file.size <= 0) return NextResponse.json({ error: "file required" }, { status: 400 })
    if (fileType !== "resume" && fileType !== "transcript") {
      return NextResponse.json({ error: "fileType must be resume or transcript" }, { status: 400 })
    }

    const bound = await requireBoundStudentCaller(request, rawStudent || null)
    if (!bound.ok) return bound.response
    const dbId = bound.studentDbId

    const own = sqlRows(
      await sql`
      SELECT id FROM recommendation_requests WHERE id = ${requestId} AND student_id = ${dbId} LIMIT 1
    `,
    )
    if (own.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const ext = (file.name.split(".").pop() || "pdf").toLowerCase()
    const safeExt = ext.length > 8 ? "pdf" : ext
    const fname = `${fileType}-${Date.now()}.${safeExt}`
    const buf = Buffer.from(await file.arrayBuffer())
    const relativePublicPath = `uploads/recommendations/${requestId}/${fname}`
    const url = await savePublicUpload({
      blobKey: relativePublicPath,
      relativePublicPath,
      bytes: buf,
      contentType: file.type || "application/octet-stream",
    })

    await sql`
      INSERT INTO recommendation_attachments (request_id, file_type, file_name, file_url)
      VALUES (${requestId}, ${fileType}, ${file.name}, ${url})
    `

    return NextResponse.json({ url })
  } catch (e) {
    console.error("[rec upload]", e)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })
  }
}
