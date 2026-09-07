import { app, dialog, shell, type BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const INDEX_NAME = '.codebench-index.json'
const MAX_PROJECT_FILES = 250
const MAX_FILE_BYTES = 256 * 1024

type IdeNodeLike = {
  id: string
  parentId: string | null
  kind: 'file' | 'folder'
  name: string
  content?: string
}

type IdeProjectLike = {
  id: string
  name: string
  nodes: IdeNodeLike[]
}

type IdeWorkspaceLike = {
  version: 1
  projects: IdeProjectLike[]
}

type ProjectIndex = {
  projects: Record<string, { folder: string }>
}

function rootConfigPath(): string {
  return join(app.getPath('userData'), 'codebench-local-root.json')
}

export function defaultCodebenchProjectsRoot(): string {
  return join(app.getPath('documents'), 'CourseCollab', 'CodeBench')
}

export function getLocalProjectsRoot(): string {
  try {
    if (existsSync(rootConfigPath())) {
      const parsed = JSON.parse(readFileSync(rootConfigPath(), 'utf8')) as {
        path?: unknown
      }
      if (typeof parsed.path === 'string' && parsed.path.trim()) return parsed.path.trim()
    }
  } catch {
    // use default
  }
  return defaultCodebenchProjectsRoot()
}

export async function setLocalProjectsRoot(path: string): Promise<string> {
  const next = path.trim()
  await mkdir(dirname(rootConfigPath()), { recursive: true })
  await writeFile(rootConfigPath(), `${JSON.stringify({ path: next }, null, 2)}\n`, 'utf8')
  return next
}

export async function chooseLocalProjectsRoot(
  window: BrowserWindow | null,
): Promise<{ ok: boolean; path: string; canceled?: boolean }> {
  const options = {
    title: 'Choose a folder for CodeBench projects',
    defaultPath: getLocalProjectsRoot(),
    properties: ['openDirectory', 'createDirectory'] as Array<
      'openDirectory' | 'createDirectory'
    >,
  }
  const result = window
    ? await dialog.showOpenDialog(window, options)
    : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false, path: getLocalProjectsRoot(), canceled: true }
  }
  const path = await setLocalProjectsRoot(result.filePaths[0])
  return { ok: true, path }
}

export async function revealLocalProjectsRoot(): Promise<{ ok: boolean; path: string }> {
  const path = getLocalProjectsRoot()
  await mkdir(path, { recursive: true })
  const error = await shell.openPath(path)
  return { ok: !error, path }
}

function safeSegment(raw: string): string | null {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 72)
  if (!cleaned || cleaned === '.' || cleaned === '..') return null
  return cleaned
}

function studentFolderName(studentId?: string | null): string {
  const safe = (studentId ?? '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)
  return safe || 'local'
}

function resolveInside(root: string, relative: string): string | null {
  const abs = resolve(root, relative)
  const normalizedRoot = resolve(root)
  if (abs === normalizedRoot) return abs
  if (!abs.startsWith(`${normalizedRoot}${sep}`)) return null
  return abs
}

function relativeNodePath(project: IdeProjectLike, nodeId: string): string | null {
  const parts: string[] = []
  const seen = new Set<string>()
  let current = project.nodes.find((node) => node.id === nodeId) ?? null
  while (current) {
    if (seen.has(current.id)) return null
    seen.add(current.id)
    const segment = safeSegment(current.name)
    if (!segment) return null
    parts.unshift(segment)
    current = current.parentId
      ? (project.nodes.find((node) => node.id === current!.parentId) ?? null)
      : null
  }
  return parts.length > 0 ? parts.join('/') : null
}

async function readIndex(root: string): Promise<ProjectIndex> {
  const file = join(root, INDEX_NAME)
  if (!existsSync(file)) return { projects: {} }
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as ProjectIndex
    return parsed?.projects && typeof parsed.projects === 'object' ? parsed : { projects: {} }
  } catch {
    return { projects: {} }
  }
}

async function writeIndex(root: string, index: ProjectIndex): Promise<void> {
  await writeFile(join(root, INDEX_NAME), `${JSON.stringify(index, null, 2)}\n`, 'utf8')
}

function isWorkspacePayload(value: unknown): value is IdeWorkspaceLike {
  if (!value || typeof value !== 'object') return false
  const workspace = value as IdeWorkspaceLike
  return workspace.version === 1 && Array.isArray(workspace.projects)
}

export async function syncWorkspaceProjectFiles(
  workspace: unknown,
  studentId?: string | null,
): Promise<{ ok: boolean; root: string; filesWritten: number; error?: string }> {
  const root = join(getLocalProjectsRoot(), studentFolderName(studentId))
  if (!isWorkspacePayload(workspace)) {
    return { ok: false, root, filesWritten: 0, error: 'Invalid CodeBench workspace.' }
  }

  try {
    await mkdir(root, { recursive: true })
    const index = await readIndex(root)
    let filesWritten = 0

    for (const project of workspace.projects) {
      const folderName = safeSegment(project.name) ?? 'project'
      const previous = index.projects[project.id]?.folder
      let projectDir = resolveInside(root, folderName)
      if (!projectDir) continue

      if (previous && previous !== folderName) {
        const previousDir = resolveInside(root, previous)
        if (previousDir && existsSync(previousDir) && !existsSync(projectDir)) {
          await rename(previousDir, projectDir)
        }
      }

      await mkdir(projectDir, { recursive: true })
      const written = new Set<string>()
      const files = project.nodes.filter((node) => node.kind === 'file').slice(0, MAX_PROJECT_FILES)

      for (const file of files) {
        const relative = relativeNodePath(project, file.id)
        if (!relative) continue
        const abs = resolveInside(projectDir, relative)
        if (!abs) continue
        const content = file.content ?? ''
        const bytes = Buffer.byteLength(content, 'utf8')
        if (bytes > MAX_FILE_BYTES) continue
        await mkdir(dirname(abs), { recursive: true })
        await writeFile(abs, content, 'utf8')
        written.add(relative)
        filesWritten += 1
      }

      const manifestPath = join(projectDir, '.codebench-files.json')
      let previousFiles: string[] = []
      if (existsSync(manifestPath)) {
        try {
          const parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as { files?: unknown }
          previousFiles = Array.isArray(parsed.files)
            ? parsed.files.filter((item): item is string => typeof item === 'string')
            : []
        } catch {
          previousFiles = []
        }
      }
      for (const stale of previousFiles) {
        if (written.has(stale)) continue
        const abs = resolveInside(projectDir, stale)
        if (!abs || !existsSync(abs)) continue
        await rm(abs, { force: true })
      }
      await writeFile(
        manifestPath,
        `${JSON.stringify({ id: project.id, name: project.name, files: [...written] }, null, 2)}\n`,
        'utf8',
      )
      index.projects[project.id] = { folder: folderName }
    }

    const keep = new Set(workspace.projects.map((project) => project.id))
    for (const [id, meta] of Object.entries(index.projects)) {
      if (keep.has(id)) continue
      const staleDir = resolveInside(root, meta.folder)
      if (staleDir && existsSync(staleDir)) {
        await rm(staleDir, { recursive: true, force: true })
      }
      delete index.projects[id]
    }

    await writeIndex(root, index)
    return { ok: true, root, filesWritten }
  } catch (error) {
    return {
      ok: false,
      root,
      filesWritten: 0,
      error: error instanceof Error ? error.message : 'Could not write project files.',
    }
  }
}
