import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getAdminIdFromRequest, requireAdminId } from "@/lib/admin-api-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { camp_id, slug, title, description, sort_order, status } = await request.json()
    if (!camp_id || !slug?.trim() || !title?.trim()) {
      return NextResponse.json({ error: "camp_id, slug, and title are required" }, { status: 400 })
    }

    const publishedAt = status === "published" ? new Date().toISOString() : null

    const inserted = await sql`
      INSERT INTO camp_trainings (camp_id, slug, title, description, sort_order, status, published_at)
      VALUES (
        ${Number(camp_id)},
        ${String(slug).trim()},
        ${String(title).trim()},
        ${description ?? null},
        ${sort_order ?? 0},
        ${status ?? "draft"},
        ${publishedAt}
      )
      RETURNING *
    `
    return NextResponse.json({ training: inserted[0] })
  } catch (error) {
    console.error("[admin/summer-camp/trainings POST]", error)
    return NextResponse.json({ error: "Failed to create training" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdminId(request)
  if (!admin.ok) return admin.response

  try {
    const adminId = admin.adminId
    if (!adminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { training_id, title, description, status, sort_order } = await request.json()
    if (!training_id) {
      return NextResponse.json({ error: "training_id is required" }, { status: 400 })
    }

    const publishedAt =
      status === "published"
        ? new Date().toISOString()
        : status === "unpublished"
          ? null
          : undefined

    const updated = await sql`
      UPDATE camp_trainings SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        status = COALESCE(${status ?? null}, status),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        published_at = CASE
          WHEN ${status ?? null} = 'published' THEN COALESCE(published_at, NOW())
          WHEN ${status ?? null} = 'unpublished' THEN NULL
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${Number(training_id)}
      RETURNING *
    `
    return NextResponse.json({ training: updated[0] })
  } catch (error) {
    console.error("[admin/summer-camp/trainings PATCH]", error)
    return NextResponse.json({ error: "Failed to update training" }, { status: 500 })
  }
}
