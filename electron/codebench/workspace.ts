import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CODEBENCH_LIMITS, SOURCE_FILE_NAME, UNIX_OUTPUT_NAME, WIN_OUTPUT_NAME } from './limits'

export function getSessionsRoot(): string {
  return join(tmpdir(), 'CourseCollab', 'CodeBench', 'sessions')
}

export function createSessionId(): string {
  return randomUUID()
}

export function getSessionDir(sessionId: string): string {
  return join(getSessionsRoot(), sessionId)
}

export function getSourcePath(sessionDir: string): string {
  return join(sessionDir, SOURCE_FILE_NAME)
}

export function getExecutableName(): string {
  return process.platform === 'win32' ? WIN_OUTPUT_NAME : UNIX_OUTPUT_NAME
}

export function getExecutablePath(sessionDir: string): string {
  return join(sessionDir, getExecutableName())
}

export async function createSessionWorkspace(sessionId: string, sourceCode: string): Promise<string> {
  const dir = getSessionDir(sessionId)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(getSourcePath(dir), sourceCode, { encoding: 'utf8', mode: 0o600 })
  return dir
}

export async function removeSessionWorkspace(sessionId: string): Promise<void> {
  const dir = getSessionDir(sessionId)
  await rm(dir, { recursive: true, force: true })
}

export async function cleanupStaleSessions(activeIds: ReadonlySet<string>): Promise<number> {
  const root = getSessionsRoot()
  let removed = 0
  let entries: string[]
  try {
    entries = await readdir(root)
  } catch {
    return 0
  }

  const now = Date.now()
  await Promise.all(
    entries.map(async (entry) => {
      if (activeIds.has(entry)) return
      const full = join(root, entry)
      try {
        const info = await stat(full)
        const age = now - info.mtimeMs
        if (age >= CODEBENCH_LIMITS.staleWorkspaceMs || !activeIds.has(entry)) {
          if (age >= CODEBENCH_LIMITS.staleWorkspaceMs || !info.isDirectory()) {
            await rm(full, { recursive: true, force: true })
            removed += 1
            return
          }
        }
        if (!activeIds.has(entry) && age > 5 * 60 * 1000) {
          await rm(full, { recursive: true, force: true })
          removed += 1
        }
      } catch {
        /* ignore individual cleanup failures */
      }
    }),
  )
  return removed
}

export async function cleanupAllSessions(): Promise<void> {
  await rm(getSessionsRoot(), { recursive: true, force: true })
}
