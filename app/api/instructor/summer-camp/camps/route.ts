import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"
import { requireSummerCampPortalActor } from "@/lib/summer-camp/permissions"
import { ensureSummerCampInstructorColumns } from "@/lib/ensure-summer-camp-instructor-columns"
import { instructorCanManageCamp } from "@/lib/summer-camp/faculty-camp-access"
import { slugifySegment } from "@/lib/slugify-segment"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSummerCampPortalActor(request)
    if (!auth.ok) return auth.response

    await ensureSummerCampInstructorColumns()

    const camps = await sql`
      SELECT
        c.*,
        (SELECT COUNT(*)::int FROM camp_trainings t WHERE t.camp_id = c.id) AS training_count,
        (SELECT COUNT(DISTINCT e.student_id)::int FROM camp_enrollments e WHERE e.camp_id = c.id) AS enrollment_count,
        (c.instructor_id = ${auth.instructorId}) AS is_owner
      FROM summer_camps c
      WHERE c.instructor_id = ${auth.instructorId}
         OR EXISTS (
           SELECT 1
           FROM camp_trainings t
           INNER JOIN camp_training_faculty f ON f.training_id = t.id
           WHERE t.camp_id = c.id AND f.instructor_id = ${auth.instructorId}
         )
      ORDER BY c.start_date DESC NULLS LAST, c.id DESC
    `

    return NextResponse.json({ camps })
  } catch (error) {
    console.error("[instructor/summer-camp/camps GET]", error)
    return NextResponse.json({ error: "Failed to load camps" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    await ensureSummerCampInstructorColumns()

    const { title, description, start_date, end_date, slug, status } = await request.json()
    if (!title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    const baseSlug = slugifySegment(String(slug ?? title), "summer-camp")
    let finalSlug = baseSlug
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`
      const exists = asSqlRows(await sql`
        SELECT 1 FROM summer_camps WHERE slug = ${candidate} LIMIT 1
      `)
      if (exists.length === 0) {
        finalSlug = candidate
        break
      }
    }

    const inserted = asSqlRows<Record<string, unknown>>(await sql`
      INSERT INTO summer_camps (
        slug, title, description, start_date, end_date, status, instructor_id
      )
      VALUES (
        ${finalSlug},
        ${String(title).trim()},
        ${description?.trim() || null},
        ${start_date ?? null},
        ${end_date ?? null},
        ${status === "published" || status === "active" ? status : "draft"},
        ${auth.instructorId}
      )
      RETURNING *
    `)

    return NextResponse.json({ camp: inserted[0] ?? null }, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Camp slug already exists" }, { status: 409 })
    }
    console.error("[instructor/summer-camp/camps POST]", error)
    return NextResponse.json({ error: "Failed to create camp" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const { camp_id, status, title, description, start_date, end_date } = await request.json()
    const campId = Number(camp_id)
    if (!Number.isFinite(campId)) {
      return NextResponse.json({ error: "camp_id is required" }, { status: 400 })
    }

    const allowed = await instructorCanManageCamp(auth.instructorId, campId)
    if (!allowed) {
      return NextResponse.json({ error: "You can only update camps you created" }, { status: 403 })
    }

    const rows = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE summer_camps
      SET
        status = COALESCE(${status ?? null}, status),
        title = COALESCE(${title?.trim() ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        start_date = COALESCE(${start_date ?? null}, start_date),
        end_date = COALESCE(${end_date ?? null}, end_date),
        updated_at = NOW()
      WHERE id = ${campId}
      RETURNING *
    `)

    if (rows.length === 0) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }

    return NextResponse.json({ camp: rows[0] })
  } catch (error) {
    console.error("[instructor/summer-camp/camps PATCH]", error)
    return NextResponse.json({ error: "Failed to update camp" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { camp_id?: number }
    const campId = Number(body.camp_id)
    if (!Number.isFinite(campId)) {
      return NextResponse.json({ error: "camp_id is required" }, { status: 400 })
    }

    const allowed = await instructorCanManageCamp(auth.instructorId, campId)
    if (!allowed) {
      return NextResponse.json({ error: "You can only delete camps you created" }, { status: 403 })
    }

    const rows = asSqlRows<{ status: string; enrollment_count: number }>(await sql`
      SELECT
        c.status,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.camp_id = c.id) AS enrollment_count
      FROM summer_camps c
      WHERE c.id = ${campId}
      LIMIT 1
    `)
    const camp = rows[0]
    if (!camp) {
      return NextResponse.json({ error: "Camp not found" }, { status: 404 })
    }
    if (camp.status !== "draft") {
      return NextResponse.json({ error: "Only draft programs can be deleted" }, { status: 400 })
    }
    if (Number(camp.enrollment_count) > 0) {
      return NextResponse.json({ error: "Cannot delete a program with enrolled campers" }, { status: 400 })
    }

    await sql`DELETE FROM summer_camps WHERE id = ${campId} AND status = 'draft'`
    return NextResponse.json({ success: true, deletedCamp: campId })
  } catch (error) {
    console.error("[instructor/summer-camp/camps DELETE]", error)
    return NextResponse.json({ error: "Failed to delete camp" }, { status: 500 })
  }
}
