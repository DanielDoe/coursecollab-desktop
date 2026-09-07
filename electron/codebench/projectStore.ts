import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

function safeStudentKey(studentId?: string | null): string {
  const safe = (studentId ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
  return safe || ''
}

export function codebenchWorkspaceDir(): string {
  return join(app.getPath('userData'), 'codebench-workspaces')
}

export function codebenchWorkspaceFile(studentId?: string | null): string {
  const key = safeStudentKey(studentId)
  return join(codebenchWorkspaceDir(), key ? `workspace-${key}.json` : 'workspace.json')
}

function isWorkspacePayload(value: unknown): value is { version: 1; projects: unknown[] } {
  if (!value || typeof value !== 'object') return false
  const workspace = value as { version?: unknown; projects?: unknown }
  return workspace.version === 1 && Array.isArray(workspace.projects) && workspace.projects.length > 0
}

export async function loadWorkspaceStore(studentId?: string | null): Promise<unknown | null> {
  const candidates = [codebenchWorkspaceFile(studentId)]
  if (safeStudentKey(studentId) && existsSync(codebenchWorkspaceFile())) {
    candidates.push(codebenchWorkspaceFile())
  }
  for (const file of candidates) {
    if (!existsSync(file)) continue
    try {
      const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
      if (isWorkspacePayload(parsed)) return parsed
    } catch {
      // try the next candidate
    }
  }
  return null
}

export async function saveWorkspaceStore(
  workspace: unknown,
  studentId?: string | null,
): Promise<{ ok: boolean; path: string; error?: string }> {
  const path = codebenchWorkspaceFile(studentId)
  if (!isWorkspacePayload(workspace)) {
    return { ok: false, path, error: 'Invalid CodeBench workspace.' }
  }

  try {
    await mkdir(codebenchWorkspaceDir(), { recursive: true })
    const tmp = `${path}.tmp`
    await writeFile(tmp, `${JSON.stringify(workspace, null, 2)}\n`, 'utf8')
    await rename(tmp, path)
    return { ok: true, path }
  } catch (error) {
    return {
      ok: false,
      path,
      error: error instanceof Error ? error.message : 'Could not save CodeBench workspace.',
    }
  }
}
