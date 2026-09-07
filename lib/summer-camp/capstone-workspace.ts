import { sql, asSqlRows } from "@/lib/db"
import { AI_EDGE_2026_CAPSTONE_PROJECTS, type CapstoneProjectDef } from "@/lib/summer-camp/curriculum/ai-edge-projects-2026"
import { isCapstoneProjectKind, normalizeProjectKind } from "@/lib/summer-camp/project-kinds"

type ProjectRow = {
  id: number
  title: string
  description: string | null
  metadata: Record<string, unknown> | null
}

function findCurriculumDef(project: ProjectRow): CapstoneProjectDef | null {
  const meta = (project.metadata ?? {}) as Record<string, unknown>
  const slug = String(meta.slug ?? "").trim()
  if (slug) {
    const bySlug = AI_EDGE_2026_CAPSTONE_PROJECTS.find((p) => p.slug === slug)
    if (bySlug) return bySlug
  }
  return AI_EDGE_2026_CAPSTONE_PROJECTS.find((p) => p.title === project.title) ?? null
}

async function seedModuleBlocks(moduleId: number, def: CapstoneProjectDef) {
  await sql`DELETE FROM camp_module_blocks WHERE module_id = ${moduleId}`
  for (const block of def.module.blocks) {
    await sql`
      INSERT INTO camp_module_blocks (module_id, block_type, content, sort_order)
      VALUES (
        ${moduleId},
        ${block.block_type},
        ${JSON.stringify(block.content)}::jsonb,
        ${block.sort_order}
      )
    `
  }
  return def.module.blocks.length
}

/** Ensure a capstone project has a module and curriculum blocks (restores when empty). */
export async function ensureCapstoneProjectWorkspace(
  projectId: number,
  opts?: { forceReseed?: boolean },
): Promise<{ moduleId: number; created: boolean; blocksSeeded: number } | null> {
  const projectRows = asSqlRows<ProjectRow>(await sql`
    SELECT id, title, description, metadata
    FROM camp_projects
    WHERE id = ${projectId}
    LIMIT 1
  `)
  if (projectRows.length === 0) return null

  const project = projectRows[0]
  const kind = normalizeProjectKind(project.metadata, project.title)
  if (!isCapstoneProjectKind(kind)) return null

  const curriculum = findCurriculumDef(project)
  if (!curriculum) return null

  let moduleRows = asSqlRows<{ id: number }>(await sql`
    SELECT id FROM camp_modules WHERE project_id = ${projectId} ORDER BY sort_order ASC, id ASC LIMIT 1
  `)

  let created = false
  let moduleId: number

  if (moduleRows.length === 0) {
    const inserted = asSqlRows<{ id: number }>(await sql`
      INSERT INTO camp_modules (project_id, title, description, sort_order, status, published_at)
      VALUES (
        ${projectId},
        ${curriculum.module.title},
        ${curriculum.module.description ?? null},
        0,
        'published',
        NOW()
      )
      RETURNING id
    `)
    moduleId = Number(inserted[0]?.id)
    created = true
  } else {
    moduleId = Number(moduleRows[0].id)
    await sql`
      UPDATE camp_modules SET
        title = ${curriculum.module.title},
        description = ${curriculum.module.description ?? null},
        status = COALESCE(status, 'published'),
        published_at = COALESCE(published_at, NOW())
      WHERE id = ${moduleId}
    `
  }

  const countRows = asSqlRows<{ c: number }>(await sql`
    SELECT COUNT(*)::int AS c FROM camp_module_blocks WHERE module_id = ${moduleId}
  `)
  const blockCount = countRows[0]?.c ?? 0
  let blocksSeeded = 0

  if (blockCount === 0 || opts?.forceReseed) {
    blocksSeeded = await seedModuleBlocks(moduleId, curriculum)
  }

  return { moduleId, created, blocksSeeded }
}

/** Restore curriculum blocks when a capstone module workspace is empty. */
export async function ensureCapstoneModuleBlocks(moduleId: number): Promise<number> {
  const rows = asSqlRows<ProjectRow & { module_id: number }>(await sql`
    SELECT p.id, p.title, p.description, p.metadata, m.id AS module_id
    FROM camp_modules m
    JOIN camp_projects p ON p.id = m.project_id
    WHERE m.id = ${moduleId}
    LIMIT 1
  `)
  if (rows.length === 0) return 0

  const project = rows[0]
  const kind = normalizeProjectKind(project.metadata, project.title)
  if (!isCapstoneProjectKind(kind)) return 0

  const countRows = asSqlRows<{ c: number }>(await sql`
    SELECT COUNT(*)::int AS c FROM camp_module_blocks WHERE module_id = ${moduleId}
  `)
  if ((countRows[0]?.c ?? 0) > 0) return 0

  const curriculum = findCurriculumDef(project)
  if (!curriculum) return 0

  return seedModuleBlocks(moduleId, curriculum)
}
