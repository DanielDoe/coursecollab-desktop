import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { isFacultyAssignedToTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { isCurriculumProjectKind } from "@/lib/summer-camp/project-kinds"
import { notifyCampModuleRelease } from "@/lib/summer-camp-notifications"
import { ensureCampModuleScheduleColumns } from "@/lib/ensure-camp-module-schedule-columns"
import { sortCampModulesBySchedule } from "@/lib/summer-camp/module-schedule"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const trainingId = Number(request.nextUrl.searchParams.get("trainingId"))
    if (!Number.isFinite(trainingId)) {
      return NextResponse.json({ error: "trainingId required" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    const scopeFilter = request.nextUrl.searchParams.get("scope") ?? "curriculum"

    await ensureCampModuleScheduleColumns()

    const rows = asSqlRows<
      Record<string, unknown> & {
        project_title: string
        project_metadata: Record<string, unknown> | null
      }
    >(await sql`
      SELECT m.*, p.title AS project_title, p.metadata AS project_metadata
      FROM camp_modules m
      JOIN camp_projects p ON p.id = m.project_id
      WHERE p.training_id = ${trainingId}
      ORDER BY p.sort_order ASC, m.sort_order ASC
    `)

    const modules =
      scopeFilter === "all"
        ? sortCampModulesBySchedule(rows)
        : sortCampModulesBySchedule(
            rows.filter((row) =>
              isCurriculumProjectKind(row.project_metadata, String(row.project_title)),
            ),
          )

    return NextResponse.json({ modules })
  } catch (error) {
    console.error("[instructor/summer-camp/modules GET]", error)
    return NextResponse.json({ error: "Failed to load modules" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { project_id, title, description, sort_order } = await request.json()
    if (!project_id || !title?.trim()) {
      return NextResponse.json({ error: "project_id and title required" }, { status: 400 })
    }

    const projectRows = asSqlRows<{ training_id: number }>(await sql`
      SELECT training_id FROM camp_projects WHERE id = ${Number(project_id)} LIMIT 1
    `)
    if (projectRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const trainingId = Number(projectRows[0].training_id)
    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    const inserted = asSqlRows<Record<string, unknown>>(await sql`
      INSERT INTO camp_modules (project_id, title, description, sort_order, status)
      VALUES (${Number(project_id)}, ${String(title).trim()}, ${description ?? null}, ${sort_order ?? 0}, 'draft')
      RETURNING *
    `)
    return NextResponse.json({ module: inserted[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/modules POST]", error)
    return NextResponse.json({ error: "Failed to create module" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { module_id, title, description, status, sort_order, is_visible, schedule_day, schedule_day_sort } =
      await request.json()
    if (!module_id) {
      return NextResponse.json({ error: "module_id required" }, { status: 400 })
    }

    const modRows = asSqlRows<{ training_id: number }>(await sql`
      SELECT p.training_id, m.title AS old_title
      FROM camp_modules m
      JOIN camp_projects p ON p.id = m.project_id
      WHERE m.id = ${Number(module_id)}
      LIMIT 1
    `)
    if (modRows.length === 0) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const trainingId = Number(modRows[0].training_id)
    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    await ensureCampModuleScheduleColumns()

    const wasDraft = asSqlRows<{ status: string }>(await sql`
      SELECT status FROM camp_modules WHERE id = ${Number(module_id)} LIMIT 1
    `)
    const prevStatus = wasDraft[0]?.status ?? ""

    const updated = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE camp_modules SET
        title = COALESCE(${title ?? null}, title),
        description = COALESCE(${description ?? null}, description),
        status = COALESCE(${status ?? null}, status),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        is_visible = COALESCE(${is_visible ?? null}, is_visible),
        schedule_day = CASE
          WHEN ${schedule_day === undefined} THEN schedule_day
          ELSE ${schedule_day}
        END,
        schedule_day_sort = COALESCE(${schedule_day_sort ?? null}, schedule_day_sort),
        published_at = CASE
          WHEN ${status ?? null} = 'published' THEN COALESCE(published_at, NOW())
          ELSE published_at
        END,
        updated_at = NOW()
      WHERE id = ${Number(module_id)}
      RETURNING *
    `)

    if (status === "published" && prevStatus !== "published") {
      const enrolled = asSqlRows<{ student_id: number }>(await sql`
        SELECT student_id FROM camp_enrollments
        WHERE training_id = ${trainingId} AND status = 'active'
      `)
      const ids = enrolled.map((r) => r.student_id)
      if (ids.length > 0 && updated[0]) {
        await notifyCampModuleRelease(ids, String(updated[0].title), Number(module_id))
      }
    }

    return NextResponse.json({ module: updated[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/modules PATCH]", error)
    return NextResponse.json({ error: "Failed to update module" }, { status: 500 })
  }
}
