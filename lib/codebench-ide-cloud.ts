import { sql } from "@/lib/db"
import { isValidWorkspace, type IdeWorkspace, workspaceUpdatedAt } from "@/lib/codebench-ide-workspace"

export const CODEBENCH_WORKSPACE_MAX_BYTES = 1_500_000

let schemaPromise: Promise<void> | null = null

export async function ensureCodebenchIdeWorkspaceSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = applySchema().catch((error) => {
      schemaPromise = null
      throw error
    })
  }
  await schemaPromise
}

async function applySchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS codebench_ide_workspaces (
      student_id INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
      workspace JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export function parseIdeWorkspacePayload(value: unknown): IdeWorkspace | null {
  if (!isValidWorkspace(value)) return null
  return value
}

export async function fetchStudentIdeWorkspace(
  studentId: number,
): Promise<{ workspace: IdeWorkspace; updatedAt: number } | null> {
  await ensureCodebenchIdeWorkspaceSchema()
  const rows = await sql`
    SELECT workspace, EXTRACT(EPOCH FROM updated_at) * 1000 AS updated_ms
    FROM codebench_ide_workspaces
    WHERE student_id = ${studentId}
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return null
  const workspace = parseIdeWorkspacePayload(row.workspace)
  if (!workspace) return null
  const updatedAt = Math.max(Number(row.updated_ms) || 0, workspaceUpdatedAt(workspace))
  return { workspace, updatedAt }
}

export async function saveStudentIdeWorkspace(
  studentId: number,
  workspace: IdeWorkspace,
): Promise<{ workspace: IdeWorkspace; updatedAt: number; conflict: boolean }> {
  await ensureCodebenchIdeWorkspaceSchema()
  const incomingUpdatedAt = workspaceUpdatedAt(workspace)
  const existing = await fetchStudentIdeWorkspace(studentId)
  if (existing && existing.updatedAt > incomingUpdatedAt) {
    return { ...existing, conflict: true }
  }

  const payload = JSON.stringify(workspace)
  await sql`
    INSERT INTO codebench_ide_workspaces (student_id, workspace, updated_at)
    VALUES (${studentId}, ${payload}::jsonb, NOW())
    ON CONFLICT (student_id) DO UPDATE SET
      workspace = EXCLUDED.workspace,
      updated_at = NOW()
  `
  return { workspace, updatedAt: incomingUpdatedAt, conflict: false }
}
