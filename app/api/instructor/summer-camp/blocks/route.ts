import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { isFacultyAssignedToTraining, getModuleTrainingId, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { ensureCapstoneModuleBlocks } from "@/lib/summer-camp/capstone-workspace"
import { CAMP_BLOCK_TYPES } from "@/lib/summer-camp/types"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const moduleId = Number(request.nextUrl.searchParams.get("moduleId"))
    if (!Number.isFinite(moduleId)) {
      return NextResponse.json({ error: "moduleId required" }, { status: 400 })
    }

    const trainingId = await getModuleTrainingId(moduleId)
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    await ensureCapstoneModuleBlocks(moduleId)

    const [blocks, moduleRows] = await Promise.all([
      sql`
        SELECT * FROM camp_module_blocks
        WHERE module_id = ${moduleId}
        ORDER BY sort_order ASC, id ASC
      `,
      sql`
        SELECT m.id, m.title, m.status, m.description, p.training_id, t.title AS training_title,
          COALESCE(p.metadata->>'kind', '') AS project_kind, p.title AS project_title
        FROM camp_modules m
        JOIN camp_projects p ON p.id = m.project_id
        JOIN camp_trainings t ON t.id = p.training_id
        WHERE m.id = ${moduleId}
        LIMIT 1
      `,
    ])
    return NextResponse.json({ blocks, module: moduleRows[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/blocks GET]", error)
    return NextResponse.json({ error: "Failed to load blocks" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { module_id, block_type, content, sort_order } = await request.json()
    if (!module_id || !block_type) {
      return NextResponse.json({ error: "module_id and block_type required" }, { status: 400 })
    }
    if (!CAMP_BLOCK_TYPES.includes(block_type)) {
      return NextResponse.json({ error: "Invalid block type" }, { status: 400 })
    }

    const trainingId = await getModuleTrainingId(Number(module_id))
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const inserted = asSqlRows<Record<string, unknown>>(await sql`
      INSERT INTO camp_module_blocks (module_id, block_type, content, sort_order)
      VALUES (
        ${Number(module_id)},
        ${block_type},
        ${JSON.stringify(content ?? {})}::jsonb,
        ${sort_order ?? 0}
      )
      RETURNING *
    `)
    return NextResponse.json({ block: inserted[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/blocks POST]", error)
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { block_id, content, sort_order, block_type } = await request.json()
    if (!block_id) {
      return NextResponse.json({ error: "block_id required" }, { status: 400 })
    }

    const blockRows = asSqlRows<{ module_id: number }>(await sql`
      SELECT module_id FROM camp_module_blocks WHERE id = ${Number(block_id)} LIMIT 1
    `)
    if (blockRows.length === 0) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 })
    }

    const trainingId = await getModuleTrainingId(Number(blockRows[0].module_id))
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    const updated = asSqlRows<Record<string, unknown>>(await sql`
      UPDATE camp_module_blocks SET
        content = COALESCE(${content != null ? JSON.stringify(content) : null}::jsonb, content),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        block_type = COALESCE(${block_type ?? null}, block_type),
        updated_at = NOW()
      WHERE id = ${Number(block_id)}
      RETURNING *
    `)
    return NextResponse.json({ block: updated[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/blocks PUT]", error)
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const blockId = Number(request.nextUrl.searchParams.get("blockId"))
    if (!Number.isFinite(blockId)) {
      return NextResponse.json({ error: "blockId required" }, { status: 400 })
    }

    const blockRows = asSqlRows<{ module_id: number }>(await sql`
      SELECT module_id FROM camp_module_blocks WHERE id = ${blockId} LIMIT 1
    `)
    if (blockRows.length === 0) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 })
    }

    const trainingId = await getModuleTrainingId(Number(blockRows[0].module_id))
    if (trainingId == null) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, trainingId)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned" }, { status: 403 })
    }

    await sql`DELETE FROM camp_module_blocks WHERE id = ${blockId}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[instructor/summer-camp/blocks DELETE]", error)
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 })
  }
}
