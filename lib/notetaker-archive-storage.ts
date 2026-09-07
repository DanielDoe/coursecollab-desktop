/**
 * Browser-local AI Notetaker archive (device-only hide), matching mobile
 * `notetaker-archive-storage.ts`. Not synced to the server.
 */

const STORAGE_PREFIX = "cc-notetaker-archived-v1:"

type ArchiveStore = {
  version: 1
  noteIds: number[]
}

function storageKey(studentId: string): string {
  return `${STORAGE_PREFIX}${studentId}`
}

function readStore(studentId: string): ArchiveStore {
  if (typeof window === "undefined") return { version: 1, noteIds: [] }
  try {
    const raw = window.localStorage.getItem(storageKey(studentId))
    if (!raw) return { version: 1, noteIds: [] }
    const parsed = JSON.parse(raw) as Partial<ArchiveStore>
    if (parsed.version === 1 && Array.isArray(parsed.noteIds)) {
      return {
        version: 1,
        noteIds: parsed.noteIds.filter((id) => Number.isFinite(id)).map(Number),
      }
    }
  } catch {
    /* first run / corrupt */
  }
  return { version: 1, noteIds: [] }
}

function writeStore(studentId: string, store: ArchiveStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(storageKey(studentId), JSON.stringify(store))
}

export function loadArchivedNoteIds(studentId: string): Set<number> {
  return new Set(readStore(studentId).noteIds)
}

export function archiveNotetakerNote(studentId: string, noteId: number): Set<number> {
  const store = readStore(studentId)
  if (!store.noteIds.includes(noteId)) {
    store.noteIds.unshift(noteId)
  }
  writeStore(studentId, store)
  return new Set(store.noteIds)
}

export function restoreNotetakerNote(studentId: string, noteId: number): Set<number> {
  const store = readStore(studentId)
  store.noteIds = store.noteIds.filter((id) => id !== noteId)
  writeStore(studentId, store)
  return new Set(store.noteIds)
}

export function removeArchivedNotetakerNote(studentId: string, noteId: number): Set<number> {
  return restoreNotetakerNote(studentId, noteId)
}
