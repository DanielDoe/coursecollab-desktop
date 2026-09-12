import type { CodebenchLanguageId } from "@/lib/codebench-languages"
import { getCodebenchLanguage } from "@/lib/codebench-languages"
import {
  type IdeProject,
  type IdeWorkspace,
  isValidWorkspace,
  newIdeId,
  sanitizeIdeName,
} from "@/lib/codebench-ide-workspace"
import { instructorCodebenchOwnerKey } from "@/lib/codebench-instructor-scope"

export type InstructorProblemKind = "classroom" | "library"

export type InstructorProblemScope = {
  kind: InstructorProblemKind
  id: string
}

export type InstructorProblemRecord = {
  version: 1
  scope: InstructorProblemScope
  title: string
  languageId: CodebenchLanguageId
  project: IdeProject
  updatedAt: number
}

const STORAGE_PREFIX = "codebench_instructor_problem_v1"
const INDEX_SUFFIX = "codebench_instructor_problem_index_v1"

function storageKey(ownerKey: string, scope: InstructorProblemScope) {
  return `${STORAGE_PREFIX}:${ownerKey}:${scope.kind}:${scope.id}`
}

function indexKey(ownerKey: string) {
  return `${INDEX_SUFFIX}:${ownerKey}`
}

export function instructorProblemProjectId(scope: InstructorProblemScope): string {
  const safeId = scope.id.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `iproblem_${scope.kind}_${safeId}`
}

export function isInstructorProblemProjectId(projectId: string): boolean {
  return projectId.startsWith("iproblem_")
}

export function parseInstructorProblemProjectId(projectId: string): InstructorProblemScope | null {
  if (!projectId.startsWith("iproblem_")) return null
  const rest = projectId.slice("iproblem_".length)
  const splitAt = rest.indexOf("_")
  if (splitAt <= 0) return null
  const kind = rest.slice(0, splitAt)
  if (kind !== "classroom" && kind !== "library") return null
  const id = rest.slice(splitAt + 1)
  if (!id) return null
  return { kind, id }
}

export function instructorProblemDurableKey(ownerKey: string, scope: InstructorProblemScope): string {
  const owner = ownerKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16)
  const prefix = scope.kind === "classroom" ? "pc" : "pl"
  const id = scope.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12)
  return `${owner}_${prefix}_${id}`.slice(0, 32)
}

function isValidRecord(value: unknown): value is InstructorProblemRecord {
  if (!value || typeof value !== "object") return false
  const record = value as InstructorProblemRecord
  return (
    record.version === 1 &&
    Boolean(record.scope?.kind && record.scope?.id) &&
    typeof record.title === "string" &&
    record.project != null &&
    Array.isArray(record.project.nodes)
  )
}

export function buildFreshProblemProject(input: {
  scope: InstructorProblemScope
  title: string
  languageId: CodebenchLanguageId
  starterCode: string
  starterFileName?: string
}): IdeProject {
  const now = Date.now()
  const language = getCodebenchLanguage(input.languageId)
  const fileName = sanitizeIdeName(input.starterFileName ?? language.fileName, language.fileName)
  const file = {
    id: newIdeId("file"),
    parentId: null as string | null,
    kind: "file" as const,
    name: fileName,
    languageId: input.languageId,
    content: input.starterCode,
    lastSavedContent: input.starterCode,
    createdAt: now,
    updatedAt: now,
  }
  return {
    id: instructorProblemProjectId(input.scope),
    name: sanitizeIdeName(input.title, "Problem"),
    createdAt: now,
    updatedAt: now,
    nodes: [file],
    activeFileId: file.id,
    openFileIds: [file.id],
  }
}

export function loadInstructorProblemRecord(
  scope: InstructorProblemScope,
  ownerKey?: string,
): InstructorProblemRecord | null {
  const key = instructorCodebenchOwnerKey(ownerKey)
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(storageKey(key, scope))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return isValidRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function persistInstructorProblemRecord(
  record: InstructorProblemRecord,
  ownerKey?: string,
): void {
  const key = instructorCodebenchOwnerKey(ownerKey)
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(key, record.scope), JSON.stringify(record))
    upsertInstructorProblemIndex(record, key)
  } catch {
    // quota
  }
}

type ProblemIndexEntry = {
  scope: InstructorProblemScope
  title: string
  languageId: CodebenchLanguageId
  updatedAt: number
}

function upsertInstructorProblemIndex(record: InstructorProblemRecord, ownerKey: string) {
  try {
    const raw = window.localStorage.getItem(indexKey(ownerKey))
    const list: ProblemIndexEntry[] = raw ? (JSON.parse(raw) as ProblemIndexEntry[]) : []
    const nextEntry: ProblemIndexEntry = {
      scope: record.scope,
      title: record.title,
      languageId: record.languageId,
      updatedAt: record.updatedAt,
    }
    const without = list.filter(
      (entry) => !(entry.scope.kind === record.scope.kind && entry.scope.id === record.scope.id),
    )
    without.unshift(nextEntry)
    window.localStorage.setItem(indexKey(ownerKey), JSON.stringify(without.slice(0, 200)))
  } catch {
    // ignore index failures
  }
}

export function listInstructorProblemIndex(ownerKey?: string): ProblemIndexEntry[] {
  const key = instructorCodebenchOwnerKey(ownerKey)
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(indexKey(key))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ProblemIndexEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function recordToMiniWorkspace(record: InstructorProblemRecord): IdeWorkspace {
  return {
    version: 1,
    explorerOpen: true,
    activeProjectId: record.project.id,
    projects: [record.project],
  }
}

function projectFromMiniWorkspace(workspace: IdeWorkspace, expectedProjectId: string): IdeProject | null {
  const project = workspace.projects.find((item) => item.id === expectedProjectId)
  return project ?? workspace.projects[0] ?? null
}

export async function loadInstructorProblemRecordDurable(
  scope: InstructorProblemScope,
  ownerKey?: string,
): Promise<InstructorProblemRecord | null> {
  const key = instructorCodebenchOwnerKey(ownerKey)
  const durableKey = instructorProblemDurableKey(key, scope)

  if (typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.loadProblemWorkspace) {
    try {
      const result = await window.courseCollabDesktop.codebench.loadProblemWorkspace(durableKey)
      if (result.ok && isValidRecord(result.record)) return result.record
    } catch {
      // fall through
    }
  }

  if (typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.loadWorkspace) {
    try {
      const result = await window.courseCollabDesktop.codebench.loadWorkspace(durableKey)
      if (result.workspace && isValidWorkspace(result.workspace)) {
        const project = projectFromMiniWorkspace(result.workspace, instructorProblemProjectId(scope))
        if (!project) return null
        return {
          version: 1,
          scope,
          title: project.name,
          languageId: project.nodes.find((node) => node.kind === "file")?.languageId ?? "cpp",
          project,
          updatedAt: project.updatedAt,
        }
      }
    } catch {
      // fall through
    }
  }

  return null
}

export async function persistInstructorProblemRecordDurable(
  record: InstructorProblemRecord,
  ownerKey?: string,
): Promise<void> {
  const key = instructorCodebenchOwnerKey(ownerKey)
  const durableKey = instructorProblemDurableKey(key, record.scope)

  if (typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.saveProblemWorkspace) {
    try {
      await window.courseCollabDesktop.codebench.saveProblemWorkspace(record, durableKey)
      return
    } catch {
      // fall through
    }
  }

  if (typeof window !== "undefined" && window.courseCollabDesktop?.codebench?.saveWorkspace) {
    try {
      await window.courseCollabDesktop.codebench.saveWorkspace(recordToMiniWorkspace(record), durableKey)
    } catch {
      // keep localStorage copy
    }
  }
}

export async function resolveInstructorProblemRecord(
  scope: InstructorProblemScope,
  ownerKey?: string,
): Promise<InstructorProblemRecord | null> {
  const local = loadInstructorProblemRecord(scope, ownerKey)
  const disk = await loadInstructorProblemRecordDurable(scope, ownerKey)
  if (!local && !disk) return null
  if (!local) return disk
  if (!disk) return local
  return local.updatedAt >= disk.updatedAt ? local : disk
}
