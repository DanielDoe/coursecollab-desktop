import { type NextRequest, NextResponse } from "next/server"
import { sql, asSqlRows } from "@/lib/db"
import { isFacultyAssignedToTraining, requireSummerCampStaff } from "@/lib/summer-camp/permissions"
import { isCapstoneProjectKind, normalizeProjectKind } from "@/lib/summer-camp/project-kinds"
import { ensureCapstoneProjectWorkspace } from "@/lib/summer-camp/capstone-workspace"

export const dynamic = "force-dynamic"

type ProjectRow = {
  id: number
  title: string
  description: string | null
  sort_order: number
  metadata: Record<string, unknown> | null
}

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

    const projectRows = asSqlRows<ProjectRow>(await sql`
      SELECT id, title, description, sort_order, metadata
      FROM camp_projects
      WHERE training_id = ${trainingId}
      ORDER BY sort_order ASC, id ASC
    `)

    const projects = []
    for (const project of projectRows) {
      const kind = normalizeProjectKind(project.metadata, project.title)
      if (!isCapstoneProjectKind(kind)) continue

      const modules = asSqlRows<{
        id: number
        title: string
        status: string
        description: string | null
      }>(await sql`
        SELECT id, title, status, description
        FROM camp_modules
        WHERE project_id = ${project.id}
        ORDER BY sort_order ASC, id ASC
      `)

      const blockCounts = asSqlRows<{ c: number }>(await sql`
        SELECT COUNT(*)::int AS c
        FROM camp_module_blocks b
        JOIN camp_modules m ON m.id = b.module_id
        WHERE m.project_id = ${project.id}
      `)

      const meta = (project.metadata ?? {}) as Record<string, unknown>
      projects.push({
        id: project.id,
        title: project.title,
        description: project.description,
        sort_order: project.sort_order,
        kind,
        metadata: meta,
        difficulty: String(meta.difficulty ?? ""),
        required: meta.required === true,
        estimated_hours: String(meta.estimated_hours ?? ""),
        badge: String(meta.badge ?? ""),
        xp_reward: Number(meta.xp_reward ?? 0),
        overview: String(meta.overview ?? ""),
        learning_outcomes: Array.isArray(meta.learning_outcomes)
          ? meta.learning_outcomes.map(String)
          : [],
        modules,
        block_count: blockCounts[0]?.c ?? 0,
        primary_module_id: modules[0]?.id ?? null,
      })
    }

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("[instructor/summer-camp/projects GET]", error)
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const body = await request.json()
    const projectId = Number(body.project_id)
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: "project_id required" }, { status: 400 })
    }

    const projectRows = asSqlRows<ProjectRow & { training_id: number }>(await sql`
      SELECT id, title, description, sort_order, metadata, training_id
      FROM camp_projects
      WHERE id = ${projectId}
      LIMIT 1
    `)
    if (projectRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const project = projectRows[0]
    const kind = normalizeProjectKind(project.metadata, project.title)
    if (!isCapstoneProjectKind(kind)) {
      return NextResponse.json({ error: "Only capstone projects can be edited here" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, project.training_id)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    const meta = { ...(project.metadata ?? {}) } as Record<string, unknown>
    if (body.difficulty != null) meta.difficulty = String(body.difficulty)
    if (body.estimated_hours != null) meta.estimated_hours = String(body.estimated_hours)
    if (body.badge != null) meta.badge = String(body.badge)
    if (body.xp_reward != null) meta.xp_reward = Number(body.xp_reward)
    if (body.overview != null) meta.overview = String(body.overview)
    if (body.required != null) meta.required = Boolean(body.required)
    if (Array.isArray(body.learning_outcomes)) {
      meta.learning_outcomes = body.learning_outcomes.map(String)
    }

    const updated = asSqlRows<ProjectRow>(await sql`
      UPDATE camp_projects SET
        title = COALESCE(${body.title?.trim() ?? null}, title),
        description = COALESCE(${body.description?.trim() ?? null}, description),
        metadata = ${JSON.stringify(meta)}::jsonb,
        updated_at = NOW()
      WHERE id = ${projectId}
      RETURNING id, title, description, sort_order, metadata
    `)

    return NextResponse.json({ project: updated[0] ?? null })
  } catch (error) {
    console.error("[instructor/summer-camp/projects PATCH]", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scope = await requireSummerCampStaff(request)
    if (!scope.ok) return scope.response

    const { project_id } = await request.json()
    const projectId = Number(project_id)
    if (!Number.isFinite(projectId)) {
      return NextResponse.json({ error: "project_id required" }, { status: 400 })
    }

    const projectRows = asSqlRows<ProjectRow & { training_id: number }>(await sql`
      SELECT id, title, description, sort_order, metadata, training_id
      FROM camp_projects
      WHERE id = ${projectId}
      LIMIT 1
    `)
    if (projectRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const project = projectRows[0]
    const kind = normalizeProjectKind(project.metadata, project.title)
    if (!isCapstoneProjectKind(kind)) {
      return NextResponse.json({ error: "Only capstone projects support content editing" }, { status: 400 })
    }

    const assigned = await isFacultyAssignedToTraining(scope.instructorId, project.training_id)
    if (!assigned) {
      return NextResponse.json({ error: "Not assigned to this training" }, { status: 403 })
    }

    const result = await ensureCapstoneProjectWorkspace(projectId)
    if (!result) {
      return NextResponse.json({ error: "No curriculum template found for this project" }, { status: 404 })
    }

    const moduleRows = asSqlRows<Record<string, unknown>>(await sql`
      SELECT * FROM camp_modules WHERE id = ${result.moduleId} LIMIT 1
    `)

    return NextResponse.json(
      {
        module: moduleRows[0] ?? { id: result.moduleId },
        created: result.created,
        blocksSeeded: result.blocksSeeded,
      },
      { status: result.created ? 201 : 200 },
    )
  } catch (error) {
    console.error("[instructor/summer-camp/projects POST]", error)
    return NextResponse.json({ error: "Failed to prepare project content workspace" }, { status: 500 })
  }
}
