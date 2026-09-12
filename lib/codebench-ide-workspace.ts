import {
  type CodebenchLanguageId,
  editorCodeForLanguage,
  extensionForLanguage,
  getCodebenchLanguage,
  isCodebenchBoilerplate,
  isUntitledCodebenchName,
  languageIdFromFileName,
  normalizeCodebenchLanguageId,
  readStoredCodebenchLanguageId,
  resolveCodebenchEditorCode,
} from "@/lib/codebench-languages"
import { stripCodebenchProbeComments } from "@/lib/codebench-strip-probe-comments"

export const CODEBENCH_IDE_STORAGE_KEY = "codebench_ide_workspace_v1"

export type IdeNodeKind = "file" | "folder"

export type IdeNode = {
  id: string
  parentId: string | null
  kind: IdeNodeKind
  name: string
  languageId?: CodebenchLanguageId
  content?: string
  lastSavedContent?: string
  untitled?: boolean
  namedByCora?: boolean
  createdAt: number
  updatedAt: number
}

export type IdeProject = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  nodes: IdeNode[]
  activeFileId: string | null
  openFileIds: string[]
}

export type IdeWorkspace = {
  version: 1
  explorerOpen: boolean
  activeProjectId: string
  projects: IdeProject[]
}

export function newIdeId(prefix = "n"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizeIdeName(raw: string, fallback = "untitled"): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 72)
  return cleaned || fallback
}

export function ensureFileExtension(name: string, languageId: CodebenchLanguageId): string {
  const base = sanitizeIdeName(name)
  if (base.includes(".")) return base
  return `${base}.${extensionForLanguage(languageId)}`
}

export function filePath(project: IdeProject, nodeId: string): string {
  const parts: string[] = []
  let current = project.nodes.find((node) => node.id === nodeId) ?? null
  while (current) {
    parts.unshift(current.name)
    current = current.parentId ? project.nodes.find((node) => node.id === current!.parentId) ?? null : null
  }
  return parts.join("/")
}

export function isFileDirty(file: IdeNode | null | undefined): boolean {
  if (!file || file.kind !== "file") return false
  return (file.content ?? "") !== (file.lastSavedContent ?? "")
}

function createFileNode(
  name: string,
  languageId: CodebenchLanguageId,
  content: string,
  options?: { parentId?: string | null; untitled?: boolean },
): IdeNode {
  const now = Date.now()
  return {
    id: newIdeId("file"),
    parentId: options?.parentId ?? null,
    kind: "file",
    name,
    languageId,
    content,
    lastSavedContent: content,
    untitled: options?.untitled ?? isUntitledCodebenchName(name),
    createdAt: now,
    updatedAt: now,
  }
}

function createFolderNode(name: string, parentId: string | null = null): IdeNode {
  const now = Date.now()
  return {
    id: newIdeId("folder"),
    parentId,
    kind: "folder",
    name: sanitizeIdeName(name, "folder"),
    createdAt: now,
    updatedAt: now,
  }
}

function nextUntitledName(project: IdeProject, languageId: CodebenchLanguageId): string {
  const ext = extensionForLanguage(languageId)
  const used = new Set(project.nodes.filter((node) => node.kind === "file").map((node) => node.name.toLowerCase()))
  if (!used.has(`untitled.${ext}`)) return `untitled.${ext}`
  let index = 2
  while (used.has(`untitled-${index}.${ext}`)) index += 1
  return `untitled-${index}.${ext}`
}

function nextCopyName(project: IdeProject, name: string, parentId: string | null, excludeId?: string): string {
  const used = new Set(
    project.nodes
      .filter((node) => node.parentId === parentId && node.id !== excludeId)
      .map((node) => node.name.toLowerCase()),
  )
  if (!used.has(name.toLowerCase())) return name
  const dot = name.lastIndexOf(".")
  const stem = dot > 0 ? name.slice(0, dot) : name
  const ext = dot > 0 ? name.slice(dot) : ""
  let index = 2
  while (used.has(`${stem}-${index}${ext}`.toLowerCase())) index += 1
  return `${stem}-${index}${ext}`
}

export function uniqueChildName(project: IdeProject, name: string, parentId: string | null, excludeId?: string): string {
  return nextCopyName(project, name, parentId, excludeId)
}

function seedProjectFromLegacyEditor(): IdeProject {
  const storedLanguage = readStoredCodebenchLanguageId()
  const content = resolveCodebenchEditorCode(storedLanguage)
  const language = getCodebenchLanguage(storedLanguage)
  const file = createFileNode(language.fileName, language.id, content)
  const now = Date.now()
  return {
    id: newIdeId("proj"),
    name: "My Project",
    createdAt: now,
    updatedAt: now,
    nodes: [file],
    activeFileId: file.id,
    openFileIds: [file.id],
  }
}

export function createEmptyWorkspace(): IdeWorkspace {
  const project = seedProjectFromLegacyEditor()
  return {
    version: 1,
    explorerOpen: true,
    activeProjectId: project.id,
    projects: [project],
  }
}

function normalizeWorkspaceLanguages(workspace: IdeWorkspace): IdeWorkspace {
  return {
    ...workspace,
    projects: workspace.projects.map((project) => ({
      ...project,
      nodes: project.nodes.map((node) =>
        node.kind === "file" && node.languageId
          ? { ...node, languageId: normalizeCodebenchLanguageId(node.languageId) }
          : node,
      ),
    })),
  }
}

export function isValidWorkspace(value: unknown): value is IdeWorkspace {
  if (!value || typeof value !== "object") return false
  const workspace = value as IdeWorkspace
  return (
    workspace.version === 1 &&
    Array.isArray(workspace.projects) &&
    workspace.projects.length > 0 &&
    typeof workspace.activeProjectId === "string"
  )
}

export function ideWorkspaceStorageKey(studentId?: string | null): string {
  const id = studentId?.trim()
  return id ? `${CODEBENCH_IDE_STORAGE_KEY}:${id}` : CODEBENCH_IDE_STORAGE_KEY
}

export function readStoredIdeWorkspace(studentId?: string | null): IdeWorkspace | null {
  if (typeof window === "undefined") return null
  const keys = [ideWorkspaceStorageKey(studentId)]
  if (studentId) keys.push(CODEBENCH_IDE_STORAGE_KEY)
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as unknown
      if (isValidWorkspace(parsed)) return normalizeWorkspaceLanguages(parsed)
    } catch {
      // try the next key
    }
  }
  return null
}

function sanitizeWorkspaceFiles(workspace: IdeWorkspace): IdeWorkspace {
  let changed = false
  const projects = workspace.projects.map((project) => {
    let projectChanged = false
    const nodes = project.nodes.map((node) => {
      if (node.kind !== "file") return node
      const content = stripCodebenchProbeComments(node.content ?? "")
      const lastSavedContent = stripCodebenchProbeComments(node.lastSavedContent ?? "")
      if (content === (node.content ?? "") && lastSavedContent === (node.lastSavedContent ?? "")) {
        return node
      }
      projectChanged = true
      return { ...node, content, lastSavedContent, updatedAt: Date.now() }
    })
    if (!projectChanged) return project
    changed = true
    return { ...project, nodes, updatedAt: Date.now() }
  })
  return changed ? { ...workspace, projects } : workspace
}

export function loadIdeWorkspace(studentId?: string | null): IdeWorkspace {
  return sanitizeWorkspaceFiles(readStoredIdeWorkspace(studentId) ?? createEmptyWorkspace())
}

export function persistIdeWorkspace(workspace: IdeWorkspace, studentId?: string | null): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(ideWorkspaceStorageKey(studentId), JSON.stringify(workspace))
    if (studentId) {
      window.localStorage.setItem(CODEBENCH_IDE_STORAGE_KEY, JSON.stringify(workspace))
    }
  } catch {
    // quota / private mode
  }
}

function canUseDiskWorkspace(): boolean {
  return Boolean(typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.loadWorkspace)
}

export function canUseLocalProjectFiles(): boolean {
  return Boolean(typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.syncProjectFiles)
}

export function workspaceUpdatedAt(workspace: IdeWorkspace): number {
  return workspace.projects.reduce((latest, project) => Math.max(latest, project.updatedAt || 0), 0)
}

export function isPlaceholderWorkspace(workspace: IdeWorkspace): boolean {
  if (workspace.projects.length !== 1) return false
  const project = workspace.projects[0]
  if (!project || !/^my project$/i.test(project.name)) return false
  const files = project.nodes.filter((node) => node.kind === "file")
  if (files.length !== 1) return false
  const file = files[0]!
  return isCodebenchBoilerplate(file.content ?? "", file.languageId ?? "cpp")
}

export function preferNewerWorkspace(left: IdeWorkspace, right: IdeWorkspace): IdeWorkspace {
  const leftPlaceholder = isPlaceholderWorkspace(left)
  const rightPlaceholder = isPlaceholderWorkspace(right)
  if (leftPlaceholder !== rightPlaceholder) return leftPlaceholder ? right : left
  return workspaceUpdatedAt(right) > workspaceUpdatedAt(left) ? right : left
}

export async function loadIdeWorkspaceFromDisk(studentId?: string | null): Promise<IdeWorkspace | null> {
  if (!canUseDiskWorkspace() || !window.courseCollabDesktop?.codebench.loadWorkspace) return null
  try {
    const result = await window.courseCollabDesktop.codebench.loadWorkspace(studentId)
    return isValidWorkspace(result.workspace) ? result.workspace : null
  } catch {
    return null
  }
}

export async function loadIdeWorkspaceFromCloud(studentId?: string | null): Promise<IdeWorkspace | null> {
  if (!studentId || typeof window === "undefined") return null
  try {
    const { studentApiFetch } = await import("@/lib/auth")
    const response = await studentApiFetch(`/api/codebench/workspace?studentId=${encodeURIComponent(studentId)}`)
    if (!response.ok) return null
    const data = (await response.json()) as { workspace?: unknown }
    return isValidWorkspace(data.workspace) ? data.workspace : null
  } catch {
    return null
  }
}

export async function persistIdeWorkspaceCloud(
  workspace: IdeWorkspace,
  studentId?: string | null,
): Promise<IdeWorkspace | null> {
  if (!studentId || typeof window === "undefined") return null
  try {
    const { studentApiFetch } = await import("@/lib/auth")
    const response = await studentApiFetch("/api/codebench/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, workspace }),
    })
    if (!response.ok) return null
    const data = (await response.json()) as { workspace?: unknown; conflict?: boolean }
    if (data.conflict && isValidWorkspace(data.workspace)) return data.workspace
    return workspace
  } catch {
    return null
  }
}

export async function persistIdeWorkspaceDurable(
  workspace: IdeWorkspace,
  studentId?: string | null,
): Promise<void> {
  persistIdeWorkspace(workspace, studentId)
  if (!canUseDiskWorkspace() || !window.courseCollabDesktop?.codebench.saveWorkspace) return
  try {
    await window.courseCollabDesktop.codebench.saveWorkspace(workspace, studentId)
  } catch {
    // keep the localStorage copy even if disk write fails
  }
}

export async function persistIdeWorkspaceProjectFiles(
  workspace: IdeWorkspace,
  studentId?: string | null,
): Promise<{ ok: boolean; root?: string } | null> {
  if (!canUseLocalProjectFiles() || !window.courseCollabDesktop?.codebench.syncProjectFiles) return null
  try {
    return await window.courseCollabDesktop.codebench.syncProjectFiles(workspace, studentId)
  } catch {
    return null
  }
}

export async function resolvePersistedIdeWorkspace(studentId?: string | null): Promise<IdeWorkspace> {
  const [local, disk, cloud] = await Promise.all([
    Promise.resolve(readStoredIdeWorkspace(studentId)),
    loadIdeWorkspaceFromDisk(studentId),
    loadIdeWorkspaceFromCloud(studentId),
  ])
  const copies = [local, disk, cloud].filter((item): item is IdeWorkspace => item != null)
  if (copies.length === 0) return createEmptyWorkspace()
  return sanitizeWorkspaceFiles(copies.reduce((newest, item) => preferNewerWorkspace(newest, item)))
}

export function getActiveProject(workspace: IdeWorkspace): IdeProject {
  return workspace.projects.find((project) => project.id === workspace.activeProjectId) ?? workspace.projects[0]!
}

export function getActiveFile(project: IdeProject): IdeNode | null {
  const file = project.nodes.find((node) => node.id === project.activeFileId && node.kind === "file")
  if (file) return file
  return project.nodes.find((node) => node.kind === "file") ?? null
}

export function childrenOf(project: IdeProject, parentId: string | null): IdeNode[] {
  return project.nodes
    .filter((node) => node.parentId === parentId)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function addFileToProject(
  project: IdeProject,
  options?: {
    languageId?: CodebenchLanguageId
    parentId?: string | null
    name?: string
    content?: string
    untitled?: boolean
  },
): IdeProject {
  const languageId = options?.languageId ?? "cpp"
  const untitled = options?.untitled ?? !options?.name
  const name = uniqueChildName(
    project,
    options?.name
      ? ensureFileExtension(options.name, languageId)
      : nextUntitledName(project, languageId),
    options?.parentId ?? null,
  )
  const content = options?.content ?? editorCodeForLanguage(languageId, { preferTemplate: true })
  const file = createFileNode(name, languageId, content, {
    parentId: options?.parentId ?? null,
    untitled,
  })
  return {
    ...project,
    nodes: [...project.nodes, file],
    activeFileId: file.id,
    openFileIds: project.openFileIds.includes(file.id) ? project.openFileIds : [...project.openFileIds, file.id],
    updatedAt: Date.now(),
  }
}

export function addFolderToProject(project: IdeProject, name: string, parentId: string | null = null): IdeProject {
  const folder = createFolderNode(uniqueChildName(project, sanitizeIdeName(name, "folder"), parentId), parentId)
  return { ...project, nodes: [...project.nodes, folder], updatedAt: Date.now() }
}

export function upsertProjectInWorkspace(workspace: IdeWorkspace, project: IdeProject): IdeWorkspace {
  const index = workspace.projects.findIndex((item) => item.id === project.id)
  const projects =
    index >= 0
      ? workspace.projects.map((item, itemIndex) => (itemIndex === index ? project : item))
      : [...workspace.projects, project]
  return {
    ...workspace,
    activeProjectId: project.id,
    projects,
  }
}

export function addProject(workspace: IdeWorkspace, name: string): IdeWorkspace {
  const languageId = "cpp"
  const file = createFileNode(
    getCodebenchLanguage(languageId).fileName,
    languageId,
    editorCodeForLanguage(languageId, { preferTemplate: true }),
  )
  const now = Date.now()
  const project: IdeProject = {
    id: newIdeId("proj"),
    name: sanitizeIdeName(name, "New Project"),
    createdAt: now,
    updatedAt: now,
    nodes: [file],
    activeFileId: file.id,
    openFileIds: [file.id],
  }
  return {
    ...workspace,
    activeProjectId: project.id,
    projects: [...workspace.projects, project],
  }
}

export function updateProject(workspace: IdeWorkspace, projectId: string, next: IdeProject): IdeWorkspace {
  return {
    ...workspace,
    projects: workspace.projects.map((project) => (project.id === projectId ? next : project)),
  }
}

export function openFileInProject(project: IdeProject, fileId: string): IdeProject {
  const file = project.nodes.find((node) => node.id === fileId && node.kind === "file")
  if (!file) return project
  return {
    ...project,
    activeFileId: file.id,
    openFileIds: project.openFileIds.includes(file.id) ? project.openFileIds : [...project.openFileIds, file.id],
    updatedAt: Date.now(),
  }
}

export function closeFileInProject(project: IdeProject, fileId: string): IdeProject {
  const openFileIds = project.openFileIds.filter((id) => id !== fileId)
  const activeFileId =
    project.activeFileId === fileId ? (openFileIds[openFileIds.length - 1] ?? project.nodes.find((node) => node.kind === "file")?.id ?? null) : project.activeFileId
  return { ...project, openFileIds, activeFileId, updatedAt: Date.now() }
}

export function updateFileContent(project: IdeProject, fileId: string, content: string): IdeProject {
  return {
    ...project,
    nodes: project.nodes.map((node) =>
      node.id === fileId && node.kind === "file"
        ? { ...node, content, updatedAt: Date.now() }
        : node,
    ),
    updatedAt: Date.now(),
  }
}

export function saveFileInProject(project: IdeProject, fileId: string): IdeProject {
  return {
    ...project,
    nodes: project.nodes.map((node) =>
      node.id === fileId && node.kind === "file"
        ? { ...node, lastSavedContent: node.content ?? "", updatedAt: Date.now() }
        : node,
    ),
    updatedAt: Date.now(),
  }
}

export function renameNodeInProject(project: IdeProject, nodeId: string, rawName: string): IdeProject {
  const node = project.nodes.find((item) => item.id === nodeId)
  if (!node) return project
  const name =
    node.kind === "folder"
      ? uniqueChildName(project, sanitizeIdeName(rawName, node.name), node.parentId, node.id)
      : uniqueChildName(
          project,
          ensureFileExtension(rawName, node.languageId ?? languageIdFromFileName(rawName)),
          node.parentId,
          node.id,
        )
  const languageId = node.kind === "file" ? languageIdFromFileName(name) : node.languageId
  return {
    ...project,
    nodes: project.nodes.map((item) =>
      item.id === nodeId
        ? {
            ...item,
            name,
            languageId,
            untitled: item.kind === "file" ? isUntitledCodebenchName(name) : item.untitled,
            namedByCora: false,
            updatedAt: Date.now(),
          }
        : item,
    ),
    updatedAt: Date.now(),
  }
}

export function deleteNodeInProject(project: IdeProject, nodeId: string): IdeProject {
  const removeIds = new Set<string>()
  const visit = (id: string) => {
    removeIds.add(id)
    project.nodes.filter((node) => node.parentId === id).forEach((child) => visit(child.id))
  }
  visit(nodeId)
  let nodes = project.nodes.filter((node) => !removeIds.has(node.id))
  if (!nodes.some((node) => node.kind === "file")) {
    const fallback = createFileNode("untitled.cpp", "cpp", editorCodeForLanguage("cpp", { preferTemplate: true }), {
      untitled: true,
    })
    nodes = [...nodes, fallback]
  }
  const openFileIds = project.openFileIds.filter((id) => !removeIds.has(id))
  const activeFileId = nodes.some((node) => node.id === project.activeFileId)
    ? project.activeFileId
    : (openFileIds[openFileIds.length - 1] ?? nodes.find((node) => node.kind === "file")?.id ?? null)
  return { ...project, nodes, openFileIds, activeFileId, updatedAt: Date.now() }
}

export function applyCoraFileName(project: IdeProject, fileId: string, suggested: string): IdeProject {
  const file = project.nodes.find((node) => node.id === fileId && node.kind === "file")
  if (!file || !file.untitled) return project
  const languageId = file.languageId ?? languageIdFromFileName(suggested)
  const name = uniqueChildName(project, ensureFileExtension(suggested, languageId), file.parentId)
  return {
    ...project,
    nodes: project.nodes.map((node) =>
      node.id === fileId
        ? { ...node, name, languageId, untitled: false, namedByCora: true, updatedAt: Date.now() }
        : node,
    ),
    updatedAt: Date.now(),
  }
}

export function setFileLanguageInProject(
  project: IdeProject,
  fileId: string,
  languageId: CodebenchLanguageId,
  content?: string,
): IdeProject {
  const language = getCodebenchLanguage(languageId)
  return {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== fileId || node.kind !== "file") return node
      const keepName = !node.untitled && !isUntitledCodebenchName(node.name)
      const stem = node.name.replace(/\.[^.]+$/, "")
      const name = keepName ? `${stem}.${extensionForLanguage(languageId)}` : language.fileName
      return {
        ...node,
        languageId,
        name: uniqueChildName({ ...project, nodes: project.nodes.filter((item) => item.id !== fileId) }, name, node.parentId),
        content: content ?? node.content,
        untitled: node.untitled && !keepName,
        updatedAt: Date.now(),
      }
    }),
    updatedAt: Date.now(),
  }
}

const STOP_WORDS = new Set([
  "main",
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "your",
  "code",
  "here",
  "function",
  "class",
  "return",
  "void",
  "int",
  "string",
])

export function heuristicFileName(code: string, languageId: CodebenchLanguageId): string {
  const ext = extensionForLanguage(languageId)
  const sample = code.trim()
  const identifiers = [
    ...sample.matchAll(/\b(?:class|struct|def|function|fn|fun|func)\s+([A-Za-z_][A-Za-z0-9_]*)/g),
  ]
    .map((match) => match[1] || "")
    .filter((name) => name && !STOP_WORDS.has(name.toLowerCase()))
  const firstPrint =
    sample.match(/(?:cout\s*<<|printf\s*\(|console\.log\s*\(|print(?:ln)?!?\s*\()\s*["']([^"']{3,40})["']/)?.[1] ||
    ""
  const source = identifiers[0] || firstPrint.replace(/[^A-Za-z0-9]+/g, " ").trim()
  const slug = source
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32)
  if (slug && !STOP_WORDS.has(slug)) return `${slug}.${ext}`
  if (!isCodebenchBoilerplate(code, languageId)) return `snippet.${ext}`
  return `untitled.${ext}`
}

export function shouldAskCoraToName(file: IdeNode | null | undefined): boolean {
  if (!file || file.kind !== "file" || !file.untitled) return false
  const content = file.content ?? ""
  const languageId = file.languageId ?? "cpp"
  if (content.trim().length < 36) return false
  return !isCodebenchBoilerplate(content, languageId)
}
