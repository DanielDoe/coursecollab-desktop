import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { requireInstructorTaManager } from "@/lib/instructor-ta-api-auth"
import { requireSummerCampPortalActor } from "@/lib/summer-camp/permissions"
import {
  instructorCanManageCamp,
  instructorCanManageTraining,
} from "@/lib/summer-camp/faculty-camp-access"
import { slugifySegment } from "@/lib/slugify-segment"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSummerCampPortalActor(request)
    if (!auth.ok) return auth.response

    const trainings = await sql`
      SELECT t.*,
        c.title AS camp_title,
        c.slug AS camp_slug,
        c.status AS camp_status,
        c.instructor_id AS camp_owner_id,
        f.role AS faculty_role,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.training_id = t.id) AS enrollment_count,
        (c.instructor_id = ${auth.instructorId}) AS is_camp_owner
      FROM camp_trainings t
      JOIN summer_camps c ON c.id = t.camp_id
      LEFT JOIN camp_training_faculty f
        ON f.training_id = t.id AND f.instructor_id = ${auth.instructorId}
      WHERE c.instructor_id = ${auth.instructorId}
         OR f.instructor_id = ${auth.instructorId}
      ORDER BY c.start_date DESC NULLS LAST, t.sort_order ASC, t.title ASC
    `

    return NextResponse.json({ trainings })
  } catch (error) {
    console.error("[instructor/summer-camp/trainings GET]", error)
    return NextResponse.json({ error: "Failed to load trainings" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const { camp_id, title, description, slug, sort_order, status } = await request.json()
    const campId = Number(camp_id)
    if (!Number.isFinite(campId) || !title?.trim()) {
      return NextResponse.json({ error: "camp_id and title are required" }, { status: 400 })
    }

    const canManage = await instructorCanManageCamp(auth.instructorId, campId)
    if (!canManage) {
      return NextResponse.json({ error: "You can only add trainings to camps you created" }, { status: 403 })
    }

    const baseSlug = slugifySegment(String(slug ?? title), "training")
    let finalSlug = baseSlug
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? baseSlug : `${baseSlug}-${i + 1}`
      const exists = asSqlRows(await sql`
        SELECT 1 FROM camp_trainings
        WHERE camp_id = ${campId} AND slug = ${candidate}
        LIMIT 1
      `)
      if (exists.length === 0) {
        finalSlug = candidate
        break
      }
    }

    const publishedAt =
      status === "published" ? new Date().toISOString() : null

    const inserted = asSqlRows<{ id: number; title: string }>(await sql`
      INSERT INTO camp_trainings (camp_id, slug, title, description, sort_order, status, published_at)
      VALUES (
        ${campId},
        ${finalSlug},
        ${String(title).trim()},
        ${description?.trim() || null},
        ${sort_order ?? 0},
        ${status === "published" ? "published" : "draft"},
        ${publishedAt}
      )
      RETURNING *
    `)

    const training = inserted[0]
    if (!training) {
      return NextResponse.json({ error: "Failed to create training" }, { status: 500 })
    }
    const trainingId = Number(training.id)

    await sql`
      INSERT INTO camp_training_faculty (training_id, instructor_id, role)
      VALUES (${trainingId}, ${auth.instructorId}, 'lead')
      ON CONFLICT (training_id, instructor_id) DO NOTHING
    `

    await sql`
      INSERT INTO camp_projects (training_id, title, description, sort_order)
      VALUES (
        ${trainingId},
        ${String(training.title)},
        ${description?.trim() || "Default project for this training track"},
        0
      )
    `

    return NextResponse.json({ training: inserted[0] }, { status: 201 })
  } catch (error) {
    console.error("[instructor/summer-camp/trainings POST]", error)
    return NextResponse.json({ error: "Failed to create training" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const { training_id, status, title, description, sort_order } = await request.json()
    const trainingId = Number(training_id)
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "training_id is required" }, { status: 400 })
    }

    const canManage = await instructorCanManageTraining(auth.instructorId, trainingId)
    if (!canManage) {
      return NextResponse.json({ error: "Not allowed to update this training" }, { status: 403 })
    }

    const publishedAt =
      status === "published" ? new Date().toISOString() : status === "draft" ? null : undefined

    const rows = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE camp_trainings
      SET
        status = COALESCE(${status ?? null}, status),
        title = COALESCE(${title?.trim() ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        published_at = CASE
          WHEN ${status ?? null} = 'published' THEN COALESCE(published_at, NOW())
          WHEN ${status ?? null} = 'draft' THEN NULL
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${trainingId}
      RETURNING *
    `)

    if (rows.length === 0) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }

    if (status === "published") {
      const campRows = asSqlRows<{ camp_id: number }>(await sql`
        SELECT camp_id FROM camp_trainings WHERE id = ${trainingId} LIMIT 1
      `)
      const campId = Number(campRows[0]?.camp_id)
      if (Number.isFinite(campId)) {
        await sql`
          UPDATE summer_camps
          SET status = CASE WHEN status = 'draft' THEN 'published' ELSE status END,
              updated_at = NOW()
          WHERE id = ${campId} AND status = 'draft'
        `
      }
    }

    return NextResponse.json({ training: rows[0] })
  } catch (error) {
    console.error("[instructor/summer-camp/trainings PATCH]", error)
    return NextResponse.json({ error: "Failed to update training" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireInstructorTaManager(request)
    if (!auth.ok) return auth.response

    const body = (await request.json()) as { training_id?: number }
    const trainingId = Number(body.training_id)
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "training_id is required" }, { status: 400 })
    }

    const canManage = await instructorCanManageTraining(auth.instructorId, trainingId)
    if (!canManage) {
      return NextResponse.json({ error: "Not allowed to delete this training" }, { status: 403 })
    }

    const rows = asSqlRows<{ status: string; enrollment_count: number }>(await sql`
      SELECT
        t.status,
        (SELECT COUNT(*)::int FROM camp_enrollments e WHERE e.training_id = t.id) AS enrollment_count
      FROM camp_trainings t
      WHERE t.id = ${trainingId}
      LIMIT 1
    `)
    const training = rows[0]
    if (!training) {
      return NextResponse.json({ error: "Training not found" }, { status: 404 })
    }
    if (training.status !== "draft") {
      return NextResponse.json({ error: "Only draft tracks can be deleted" }, { status: 400 })
    }
    if (Number(training.enrollment_count) > 0) {
      return NextResponse.json({ error: "Cannot delete a track with enrolled campers" }, { status: 400 })
    }

    await sql`DELETE FROM camp_trainings WHERE id = ${trainingId} AND status = 'draft'`
    return NextResponse.json({ success: true, deletedTraining: trainingId })
  } catch (error) {
    console.error("[instructor/summer-camp/trainings DELETE]", error)
    return NextResponse.json({ error: "Failed to delete training" }, { status: 500 })
  }
}
