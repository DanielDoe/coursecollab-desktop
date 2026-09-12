import { instructorCodebenchOwnerKey } from "@/lib/codebench-instructor-scope"

export type InstructorProjectSnapshot = {
  id: string
  projectId: string
  label: string
  createdAt: number
  files: Array<{ path: string; content: string }>
}

type HistoryStore = {
  version: 1
  snapshots: InstructorProjectSnapshot[]
}

const STORAGE_SUFFIX = "codebench_instructor_history_v1"
const MAX_SNAPSHOTS_PER_PROJECT = 24

function storageKey(ownerKey: string) {
  return `${STORAGE_SUFFIX}:${ownerKey}`
}

function newId() {
  return `snap_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function loadStore(ownerKey?: string): HistoryStore {
  const key = storageKey(ownerKey ?? instructorCodebenchOwnerKey())
  if (typeof window === "undefined") return { version: 1, snapshots: [] }
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { version: 1, snapshots: [] }
    const parsed = JSON.parse(raw) as HistoryStore
    if (parsed?.version === 1 && Array.isArray(parsed.snapshots)) return parsed
  } catch {
    // ignore
  }
  return { version: 1, snapshots: [] }
}

function persistStore(store: HistoryStore, ownerKey?: string) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(ownerKey ?? instructorCodebenchOwnerKey()), JSON.stringify(store))
  } catch {
    // ignore
  }
}

export function listProjectSnapshots(projectId: string, ownerKey?: string): InstructorProjectSnapshot[] {
  return loadStore(ownerKey)
    .snapshots.filter((entry) => entry.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function recordProjectSnapshot(input: {
  projectId: string
  label: string
  files: Array<{ path: string; content: string }>
  ownerKey?: string
}): InstructorProjectSnapshot {
  const store = loadStore(input.ownerKey)
  const snapshot: InstructorProjectSnapshot = {
    id: newId(),
    projectId: input.projectId,
    label: input.label,
    createdAt: Date.now(),
    files: input.files,
  }
  const projectSnapshots = store.snapshots.filter((entry) => entry.projectId === input.projectId)
  const kept = projectSnapshots.slice(0, MAX_SNAPSHOTS_PER_PROJECT - 1)
  store.snapshots = [
    snapshot,
    ...store.snapshots.filter((entry) => entry.projectId !== input.projectId),
    ...kept,
  ]
  persistStore(store, input.ownerKey)
  return snapshot
}
